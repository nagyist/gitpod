// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Download files to be embed in the binary
//go:generate ./dependencies.sh

package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/docker-up/dockerd"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
	"github.com/vishvananda/netlink"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

var log *logrus.Entry

const DaemonArgs = "DOCKERD_ARGS"

var opts struct {
	RuncFacade           bool
	BinDir               string
	AutoInstall          bool
	UserAccessibleSocket bool
	Verbose              bool
	DontWrapNetNS        bool
	AutoLogin            bool
}

//go:embed docker.tgz
//go:embed docker-compose
//go:embed runc
var binaries embed.FS

// ensure apt update is run only once
var aptUpdated = false

const (
	dockerSocketFN = "/var/run/docker.sock"
	gitpodUserId   = 33333
	gitpodGroupId  = 33333
	containerIf    = "eth0"
)

func main() {
	self, err := os.Executable()
	if err != nil {
		logrus.WithError(err).Fatal()
	}

	pflag.BoolVarP(&opts.Verbose, "verbose", "v", false, "enables verbose logging")
	pflag.BoolVar(&opts.RuncFacade, "runc-facade", true, "enables the runc-facade to handle rootless idiosyncrasies")
	pflag.StringVar(&opts.BinDir, "bin-dir", filepath.Dir(self), "directory where runc-facade is found")
	pflag.BoolVar(&opts.AutoInstall, "auto-install", true, "auto-install prerequisites (docker)")
	pflag.BoolVar(&opts.UserAccessibleSocket, "user-accessible-socket", true, "chmod the Docker socket to make it user accessible")
	pflag.BoolVar(&opts.DontWrapNetNS, "dont-wrap-netns", os.Getenv("WORKSPACEKIT_WRAP_NETNS") == "true", "wrap the Docker daemon in a network namespace")
	pflag.BoolVar(&opts.AutoLogin, "auto-login", false, "use content of GITPOD_IMAGE_AUTH to automatically login with the docker daemon")
	pflag.Parse()

	logger := logrus.New()
	if opts.Verbose {
		logger.SetLevel(logrus.DebugLevel)
	}

	log = logrus.NewEntry(logger)

	listenFD := os.Getenv("LISTEN_FDS") != ""
	if _, err := os.Stat(dockerSocketFN); !listenFD && (err == nil || !os.IsNotExist(err)) {
		logger.Fatalf("Docker socket already exists at %s.\nIn a Gitpod workspace Docker will start automatically when used.\nIf all else fails, please remove %s and try again.", dockerSocketFN, dockerSocketFN)
	}

	err = ensurePrerequisites()
	if err != nil {
		log.WithError(err).Fatal("failed")
	}

	err = runWithinNetns()
	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func runWithinNetns() (err error) {
	listenFDs, _ := strconv.Atoi(os.Getenv("LISTEN_FDS"))

	args := []string{
		"--data-root=/workspace/.docker-root",
		"--cri-containerd",
	}

	if opts.Verbose {
		args = append(args,
			"--log-level", "debug",
		)
	}
	if opts.RuncFacade {
		args = append(args,
			"--add-runtime", "gitpod="+filepath.Join(opts.BinDir, "runc-facade"),
			"--default-runtime", "gitpod",
		)
	}

	userArgsValue, _ := os.LookupEnv(DaemonArgs)
	userArgs, err := dockerd.ParseUserArgs(log, userArgsValue)
	if err != nil {
		return xerrors.Errorf("cannot add user supplied docker args: %w", err)
	}
	args = append(args, userArgs...)

	netIface, err := netlink.LinkByName(containerIf)
	if err != nil {
		return xerrors.Errorf("cannot get container network device %s: %w", containerIf, err)
	}

	args = append(args, fmt.Sprintf("--mtu=%v", netIface.Attrs().MTU))
	// configure docker0 MTU (used as control plane, not related to containers)
	args = append(args, fmt.Sprintf("--network-control-plane-mtu=%v", netIface.Attrs().MTU))

	// cmp. ENT-324: Required to run dockerd >= 26.1 in a Gitpod workspace
	os.Setenv("DOCKER_ALLOW_IPV6_ON_IPV4_INTERFACE", "1")

	if listenFDs > 0 {

		os.Setenv("LISTEN_PID", strconv.Itoa(os.Getpid()))
		args = append(args, "-H", "fd://")

		dockerd, err := exec.LookPath("dockerd")
		if err != nil {
			return err
		}
		argv := []string{dockerd}
		argv = append(argv, args...)
		return unix.Exec(dockerd, argv, os.Environ())
	}

	cmd := exec.Command("dockerd", args...)
	log.WithField("args", args).Debug("starting dockerd")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig: syscall.SIGKILL,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Start()
	if err != nil {
		return err
	}

	sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
	defer sigproxysignal.StopCatch(sigc)

	if opts.UserAccessibleSocket {
		go func() {
			for {
				err := os.Chmod(dockerSocketFN, 0666)

				if os.IsNotExist(err) {
					time.Sleep(500 * time.Millisecond)
					continue
				}
				if err != nil {
					log.WithError(err).Warn("cannot chmod docker socket")
				}

				return
			}
		}()
	}

	err = cmd.Wait()
	if err != nil {
		return err
	}
	return nil
}

var prerequisites = map[string]func() error{
	"dockerd":        installDocker,
	"docker-compose": installDockerCompose,
	"iptables":       installIptables,
	"uidmap":         installUidMap,
	"runcV1.1.3":     installRunc,
}

func ensurePrerequisites() error {
	var pkgs []func() error
	for cmd, pkg := range prerequisites {
		if pth, _ := exec.LookPath(cmd); pth == "" {
			log.WithField("command", cmd).Warn("missing prerequisite")
			pkgs = append(pkgs, pkg)
		}
	}
	if len(pkgs) == 0 {
		return nil
	}

	errMissingPrerequisites := xerrors.Errorf("missing prerequisites")
	if !opts.AutoInstall {
		return errMissingPrerequisites
	}

	for _, pkg := range pkgs {
		err := pkg()
		if err != nil {
			return err
		}
	}

	return nil
}

func installDocker() error {
	binary, err := binaries.Open("docker.tgz")
	if err != nil {
		return err
	}
	defer binary.Close()

	gzipReader, err := gzip.NewReader(binary)
	if err != nil {
		return err
	}

	tarReader := tar.NewReader(gzipReader)
	for {
		hdr, err := tarReader.Next()
		if err != nil {
			if err == io.EOF {
				return nil
			}

			return xerrors.Errorf("Unable to extract container: %v\n", err)
		}

		hdrInfo := hdr.FileInfo()
		dstpath := path.Join("/usr/bin", strings.TrimPrefix(hdr.Name, "docker/"))
		mode := hdrInfo.Mode()

		p, _ := filepath.Abs(hdrInfo.Name())
		if strings.Contains(p, "..") {
			// do not allow directory traversal
			continue
		}

		switch hdr.Typeflag {

		case tar.TypeReg, tar.TypeRegA: //lint:ignore SA1019 backwards compatibility
			file, err := os.OpenFile(dstpath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
			if err != nil {
				return xerrors.Errorf("unable to create file: %v", err)
			}

			if _, err := io.Copy(file, tarReader); err != nil {
				file.Close()
				return xerrors.Errorf("unable to write file: %v", err)
			}

			file.Close()
		}
		//nolint:errcheck
		os.Chtimes(dstpath, hdr.AccessTime, hdr.ModTime)
	}

	return nil
}

func installDockerCompose() error {
	return installBinary("docker-compose", "/usr/local/bin/docker-compose")
}

func installIptables() error {
	err := installPackages("iptables", "xz-utils")
	if err != nil {
		return xerrors.Errorf("could not install iptables: %w", err)
	}

	pth, _ := exec.LookPath("apk")
	if pth != "" {
		cmd := exec.Command("/bin/sh", "-c", "apk add --no-cache iptables xz")
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}

		return cmd.Run()
	}

	// the container is not debian/ubuntu/alpine
	log.WithField("command", "dockerd").Warn("Please install dockerd dependencies: iptables")
	return nil
}

func installUidMap() error {
	_, exists := os.LookupEnv(DaemonArgs)
	if !exists {
		return nil
	}

	needInstall := false
	if _, err := exec.LookPath("newuidmap"); err != nil {
		needInstall = true
	}

	if _, err := exec.LookPath("newgidmap"); err != nil {
		needInstall = true
	}

	if !needInstall {
		return nil
	}

	err := installPackages("uidmap")
	if err != nil {
		return xerrors.Errorf("could not install uidmap: %w", err)
	}

	return nil
}

func installRunc() error {
	runc, _ := exec.LookPath("runc")
	if runc != "" {
		// if the required version or a more recent one is already
		// installed do nothing
		if !needInstallRunc() {
			return nil
		}
	} else {
		runc = "/bin/runc"
	}

	err := installBinary("runc", runc)
	if err != nil {
		return xerrors.Errorf("could not install runc: %w", err)
	}

	return nil
}

func needInstallRunc() bool {
	cmd := exec.Command("runc", "--version")
	output, err := cmd.Output()
	if err != nil {
		return true
	}

	major, minor, err := detectRuncVersion(string(output))
	if err != nil {
		return true
	}

	return major < 1 || major == 1 && minor < 3
}

func detectRuncVersion(output string) (major, minor int, err error) {
	versionInfo := strings.Split(output, "\n")
	for _, l := range versionInfo {
		if !strings.HasPrefix(l, "runc version") {
			continue
		}

		l = strings.TrimPrefix(l, "runc version")
		l = strings.TrimSpace(l)

		n := strings.Split(l, ".")
		if len(n) < 2 {
			return 0, 0, xerrors.Errorf("could not parse %s", l)
		}

		major, err = strconv.Atoi(n[0])
		if err != nil {
			return 0, 0, xerrors.Errorf("could not parse major %s: %w", n[0], err)
		}

		minor, err = strconv.Atoi(n[1])
		if err != nil {
			return 0, 0, xerrors.Errorf("could not parse minor %s: %w", n[1], err)
		}

		return major, minor, nil
	}

	return 0, 0, xerrors.Errorf("could not detect runc version")
}

func installPackages(packages ...string) error {
	apt, _ := exec.LookPath("apt-get")
	if apt != "" {
		cmd := exec.Command("/bin/sh", "-c")

		var installCommand string
		if !aptUpdated {
			installCommand = "apt-get update && "
		}

		installCommand = installCommand + "apt-get install -y"
		for _, p := range packages {
			installCommand = installCommand + " " + p
		}

		cmd.Args = append(cmd.Args, installCommand)
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}

		err := cmd.Run()
		if err != nil {
			return err
		}

		aptUpdated = true
		return nil
	} else {
		return xerrors.Errorf("apt-get is not available")
	}
}

func installBinary(name, dst string) error {
	binary, err := binaries.Open(name)
	if err != nil {
		return err
	}
	defer binary.Close()

	file, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, binary)
	if err != nil {
		return err
	}

	return os.Chmod(dst, 0755)
}

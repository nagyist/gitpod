# Gitpod Project Intelligence

This file captures important patterns, preferences, and project intelligence that help me work more effectively with the Gitpod codebase. It serves as a learning journal that will be updated as I discover new insights.

## Project Structure Patterns

- **Component Organization**: The project is organized into components, each with its own directory in the `components/` folder
- **API Definitions**: API definitions are typically in separate packages with `-api` suffix (e.g., `content-service-api`)
- **Protocol Buffers**: gRPC service definitions use Protocol Buffers (`.proto` files)
- **Build Configuration**: Each component has a `BUILD.yaml` file defining its build configuration
- **Docker Configuration**: Components that run as containers have a `leeway.Dockerfile`

## Code Style Preferences

- **Go Code**:
  - Follow standard Go conventions (gofmt)
  - Error handling with explicit checks
  - Context propagation for cancellation
  - Structured logging

- **TypeScript Code**:
  - Use TypeScript for type safety
  - React for UI components
  - Functional components with hooks
  - ESLint and Prettier for formatting

## Development Workflow

- **Feature Development Process**:
  - Follow the Product Requirements Document (PRD) workflow documented in systemPatterns.md under "Development Workflows"
  - Create PRD documents in the `prd/` directory with naming convention `NNN-featurename.md`
  - Include standard sections: Overview, Background, Requirements, Implementation Details, Testing, Deployment Considerations, Future Improvements
  - Use Plan Mode for requirements gathering and planning
  - Use Act Mode for implementation and documentation updates
  - Always update memory bank with new knowledge gained during implementation
  - Reference the PRD in commit messages and documentation

- **Build Approaches**:
  - **In-tree builds** (primary for local development):
    - TypeScript components: Use `yarn` commands defined in package.json
      - `yarn build`: Compile the component
      - `yarn test`: Run tests
      - `yarn lint`: Check code style
      - `yarn watch`: Watch for changes and rebuild
    - Go components: Use standard Go tools
      - `go build ./...`: Build all packages
      - `go test ./...`: Test all packages
      - `go run main.go`: Build and run

  - **Out-of-tree builds** (Leeway, primary for CI):
    - `leeway build components/component-name:app`: Build a specific component
    - `leeway build -D components/component-name:app`: Build with dependencies
    - `leeway exec --package components/component-name:app -- command`: Run a command for a package

- **Testing**:
  - Unit tests alongside code
  - Integration tests in separate directories
  - End-to-end tests in the `test/` directory
  - Component-specific test commands in package.json (for TypeScript)
  - Go tests use standard `go test` command

- **Local Development**:
  - Use Gitpod workspaces for development (dogfooding)
  - Components can be run individually for testing
  - Preview environments for testing changes
  - Use in-tree builds for rapid iteration during development

## Critical Implementation Paths

- **Workspace Lifecycle**: The critical path for workspace operations involves:
  - Workspace Manager
  - Image Builder
  - Kubernetes
  - Workspace Daemon
  - Supervisor

- **User Authentication**: The critical path for user authentication involves:
  - Auth Service
  - Dashboard
  - Proxy

## Known Challenges

- **Build System Complexity**: The Leeway build system has a learning curve
- **Component Dependencies**: Understanding dependencies between components can be challenging
- **Testing Environment**: Setting up proper testing environments for all components

## Tool Usage Patterns

- **VS Code**: Primary IDE for TypeScript development
- **GoLand/IntelliJ**: Often used for Go development
- **Docker**: Used for containerized development and testing
- **kubectl**: Used for interacting with Kubernetes clusters
- **Werft**: CI/CD system for automated builds and tests

## Documentation Patterns

- **README.md**: Each component should have a README explaining its purpose
- **API Documentation**: Generated from Protocol Buffer definitions
- **Architecture Documentation**: System-level documentation in various formats
- **Memory Bank Documentation**:
  - Component-specific documentation is stored in `memory-bank/components/` directory
  - Each component gets its own markdown file with detailed information about its purpose, architecture, and implementation
  - Component documentation should focus on both service components that implement business logic and API components that define interfaces
  - Documentation follows a consistent structure with sections for Overview, Purpose, Architecture, Key Features, etc.
  - API component documentation should include a "Code Generation and Building" section that explains:
    - How to regenerate code from protobuf definitions
    - The implementation details of the generation process
    - How to build components that depend on the API after regeneration

## Evolution of Project Decisions

This section will be updated as I learn about how and why certain architectural and design decisions were made.

### Memory Bank Organization

- **Component Documentation**: The decision to create separate documentation files for each component in the `memory-bank/components/` directory was made to:
  1. Provide a clear, organized structure for component documentation
  2. Allow for detailed documentation of each component's purpose, architecture, and implementation
  3. Make it easier to find information about specific components
  4. Enable incremental updates to component documentation without affecting other files

- **API Component Documentation**: The decision to include "*-api" components in separate documentation was made because:
  1. API components define critical interfaces between services
  2. Understanding these interfaces is essential for developers working across components
  3. API documentation helps clarify system boundaries and communication patterns
  4. Separate documentation makes it easier to track API changes and versioning

## User Preferences

This section will be updated as I learn about specific user preferences for working with the codebase.

## Build and Test Information

When working with components, I should always document:

- **Build Commands**: Document any new or component-specific build commands I encounter
- **Test Commands**: Document how to run tests for each component
- **Dependencies**: Note any special dependencies required for building or testing
- **Common Issues**: Document common build or test issues and their solutions
- **Performance Considerations**: Note any performance considerations for builds

Whenever I encounter new build patterns or commands, I should update:
1. The relevant component documentation in `memory-bank/components/`
2. The LEARNING_JOURNAL section in `.clinerules` file with general patterns
3. The `techContext.md` file if it represents a significant pattern

This information is critical for effective development work, as being able to build and test components is fundamental to making changes and verifying their correctness.

---

Note: This file will be continuously updated as I work with the Gitpod codebase and discover new patterns, preferences, and insights.

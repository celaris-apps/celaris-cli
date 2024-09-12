
# Celaris CLI Tool

## Introduction

Celaris CLI is a command-line interface tool designed to streamline the setup and development process of Celaris projects by automating tasks like project initialization, repository cloning, and dependency management.

## Prerequisites

- Node.js (Version 12 or higher recommended)
- npm (Node Package Manager)

## Installation

Install the cli:

```bash
npm install celaris-cli
```

## Usage

### Initialising a Project

To initialise a new project, run the `init` command. This command sets up the project by cloning the necessary repositories, setting up the environment, and installing dependencies.

```bash
npm run celaris init
```

### Development Mode

To run the project in development mode, use the `dev` command. This command compiles and runs the project, and watches for any changes.

```bash
npm run celaris dev
```

You can also run the dev command without running a build command (handy on first run as the init command runs a build and test)

```bash
npm run celaris -- dev --no-build
```

## Features

- **Framework Selection:** Choose from a list of supported frameworks during initialization.
- **TypeScript Support:** Option to enable TypeScript configuration.
- **Interactive Commands:** Run commands interactively with real-time output.
- **File Filtering:** Exclude specific files or directories during copy operations.
- **Package.json Management:** Merge and manage package.json dependencies and scripts.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 

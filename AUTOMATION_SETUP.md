# Automation Test Triggering Setup

This repository is configured to automatically trigger tests in the [edendaleautomation](https://github.com/Nkosikk/edendaleautomation) repository whenever changes are pushed to the main branch.

## How it Works

1. **Main Project Workflow** (`.github/workflows/trigger-automation-tests.yml`):
   - Triggers on pushes to the `main` branch
   - Builds and tests this project
   - Sends a repository dispatch event to the automation repository
   - Sends build status updates

2. **Automation Repository Workflow** (`automation-workflow-sample.yml`):
   - Listens for repository dispatch events
   - Runs automation tests when triggered
   - Handles different scenarios based on main project build status

## Setup Instructions

### 1. Create Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with the following permissions:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
3. Copy the token

### 2. Add Secret to Main Repository

1. Go to this repository's Settings → Secrets and variables → Actions
2. Add a new repository secret:
   - **Name**: `AUTOMATION_REPO_TOKEN`
   - **Value**: The personal access token you created

### 3. Set Up Automation Repository Workflow

1. Copy the content from `automation-workflow-sample.yml`
2. In your automation repository, create `.github/workflows/run-tests-on-main-project-changes.yml`
3. Paste the content and customize the test commands for your automation framework

### 4. Customize Test Commands

Update the automation workflow file with your specific test commands:

```yaml
- name: Run automation tests
  run: |
    # Replace with your actual test commands
    npm test                    # Unit tests
    npm run test:integration   # Integration tests
    npm run test:e2e          # End-to-end tests
    npm run test:performance  # Performance tests
```

## Event Types

The workflow sends two types of events:

1. **`main-project-updated`**: Sent immediately when main project code changes
2. **`main-project-build-status`**: Sent after the main project build completes

## Payload Data

Each event includes useful information:

- Repository name and branch
- Commit SHA and message
- Person who pushed the changes
- Build status and run URL

## Testing the Setup

1. Make a small change to this repository
2. Push to the `main` branch
3. Check the Actions tab in both repositories to verify the workflow triggers

## Troubleshooting

- **Token Issues**: Ensure the personal access token has correct permissions
- **Repository Access**: Verify the token has access to both repositories
- **Workflow Permissions**: Check that Actions are enabled in both repositories
- **Secret Name**: Ensure the secret is named exactly `AUTOMATION_REPO_TOKEN`

## Alternative Approaches

If repository dispatch doesn't work for your use case, consider:

1. **Webhooks**: Set up webhook endpoints for more complex integrations
2. **Scheduled Runs**: Use cron schedules to run tests periodically
3. **Manual Triggers**: Use `workflow_dispatch` for on-demand test execution
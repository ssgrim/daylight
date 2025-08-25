# Terraform State Workspaces: dev & prod

This project uses separate Terraform state workspaces for `dev` and `prod` environments.

## How it works
- State files are stored in `infra/terraform.tfstate.d/dev/` and `infra/terraform.tfstate.d/prod/`.
- You can switch between environments using the `-state` flag or by setting the `TF_WORKSPACE` environment variable.

## Usage

### Initialize (first time)
```sh
cd infra/terraform
terraform init
```

### Select workspace
- For dev:
  ```sh
  export TF_WORKSPACE=dev
  ```
- For prod:
  ```sh
  export TF_WORKSPACE=prod
  ```

### Apply changes
```sh
terraform apply
```

### State file locations
- Dev: `../terraform.tfstate.d/dev/terraform.tfstate`
- Prod: `../terraform.tfstate.d/prod/terraform.tfstate`

## Notes
- Always double-check your workspace before applying changes!
- You can add more environments by creating new folders under `terraform.tfstate.d/` and setting `TF_WORKSPACE` accordingly.

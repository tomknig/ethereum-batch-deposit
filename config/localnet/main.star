ethereum_package = import_module(
    "github.com/kurtosis-tech/ethereum-package/main.star@1.4.0"
)
validator_keystore_generator = import_module(
    "github.com/kurtosis-tech/ethereum-package/src/prelaunch_data_generator/validator_keystores/validator_keystore_generator.star@1.4.0"
)
shared_utils = import_module(
    "github.com/kurtosis-tech/ethereum-package/src/shared_utils/shared_utils.star@1.4.0"
)
keystore_files_module = import_module(
    "github.com/kurtosis-tech/ethereum-package/src/prelaunch_data_generator/validator_keystores/keystore_files.star@1.4.0"
)

KEYSTORES_OUTPUT_DIRPATH = "/development-keystore"
KEYSTORES_GENERATION_TOOL_NAME = "/app/eth2-val-tools"

SUCCESSFUL_EXEC_CMD_EXIT_CODE = 0

RAW_KEYS_DIRNAME = "keys"
RAW_SECRETS_DIRNAME = "secrets"
NIMBUS_KEYS_DIRNAME = "nimbus-keys"
PRYSM_DIRNAME = "prysm"
TEKU_KEYS_DIRNAME = "teku-keys"
TEKU_SECRETS_DIRNAME = "teku-secrets"


def generate_development_keystore(plan, mnemonic, num_validators, capella_fork_epoch):
    service_name = validator_keystore_generator.launch_prelaunch_data_generator(
        plan,
        {},
        "genesis-data"
    )

    start_index = 0
    stop_index = num_validators

    command_str = '{0} keystores --insecure --out-loc {1} --source-mnemonic "{2}" --source-min {3} --source-max {4}'.format(
        KEYSTORES_GENERATION_TOOL_NAME,
        KEYSTORES_OUTPUT_DIRPATH,
        mnemonic,
        start_index,
        stop_index,
    )

    command_result = plan.exec(
        recipe=ExecRecipe(command=["sh", "-c", command_str]), service_name=service_name
    )
    plan.verify(command_result["code"], "==", SUCCESSFUL_EXEC_CMD_EXIT_CODE)

    # Store outputs into files artifacts
    artifact_name = plan.store_service_files(
        service_name, KEYSTORES_OUTPUT_DIRPATH, name="development-keystore"
    )

    # This is necessary because the way Kurtosis currently implements artifact-storing is
    base_dirname_in_artifact = shared_utils.path_base(KEYSTORES_OUTPUT_DIRPATH)
    keystore_files = keystore_files_module.new_keystore_files(
        artifact_name,
        shared_utils.path_join(base_dirname_in_artifact),
        shared_utils.path_join(base_dirname_in_artifact, RAW_KEYS_DIRNAME),
        shared_utils.path_join(base_dirname_in_artifact, RAW_SECRETS_DIRNAME),
        shared_utils.path_join(base_dirname_in_artifact, NIMBUS_KEYS_DIRNAME),
        shared_utils.path_join(base_dirname_in_artifact, PRYSM_DIRNAME),
        shared_utils.path_join(base_dirname_in_artifact, TEKU_KEYS_DIRNAME),
        shared_utils.path_join(base_dirname_in_artifact, TEKU_SECRETS_DIRNAME),
    )

    # we cleanup as the data generation is done
    plan.remove_service(service_name)


def deploy_lighthouse(plan, validator_params):
    generate_development_keystore(
        plan, validator_params["mnemonic"], validator_params["num_validators"], validator_params["capella_fork_epoch"]
    )
    plan.add_service(
        name="development-lighthouse-validator",
        config=ServiceConfig(
            image="sigp/lighthouse:latest",
            ports={
                "http": PortSpec(
                    number=5042,
                    transport_protocol="TCP",
                    application_protocol="",
                    wait=None,
                ),
                "metrics": PortSpec(
                    number=5064, transport_protocol="TCP", application_protocol="http"
                ),
            },
            files={
                "/genesis": "el_cl_genesis_data",
                "/validator-keys": "development-keystore",
            },
            cmd=[
                "lighthouse",
                "validator_client",
                "--debug-level=info",
                "--testnet-dir=/genesis/network-configs",
                "--validators-dir=/validator-keys/development-keystore/keys",
                "--secrets-dir=/validator-keys/development-keystore/secrets",
                "--init-slashing-protection",
                "--http",
                "--unencrypted-http-transport",
                "--http-address=0.0.0.0",
                "--http-port=5042",
                "--beacon-nodes=http://cl-1-lighthouse-geth:4000",
                "--suggested-fee-recipient=0x0000000000000000000000000000000000000000",
                "--metrics",
                "--metrics-address=0.0.0.0",
                "--metrics-allow-origin=*",
                "--metrics-port=5064",
            ],
            env_vars={"RUST_BACKTRACE": "full"},
        ),
    )


def run(plan, args):
    plan.print("Spinning up the Ethereum Network")
    network_params = args["network"]
    validator_params = args["validator"]
    plan.print(network_params)
    plan.print(validator_params)
    ethereum_package.run(
        plan, network_params
    )
    plan.print("Launching an additional client pair")
    plan.print(plan)
    deploy_lighthouse(plan, validator_params)

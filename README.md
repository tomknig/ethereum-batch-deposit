# Ethereum Batch Deposit

This repository contains the smart contract code for batch deposits into native staking on Ethereum.
The contracts are organized in the [`contracts`](/contracts) directory. [`interfaces`](/contracts/interfaces) implement external interfaces we depend on, [`lib`](/contracts/lib) contains our actual contracts and [`test`](/contracts/test) the mocked contracts for testing.

## Contracts

### BatchDeposit

The BatchDeposit contract enables deployment of multiple Ethereum validators at once. The `BatchDeposit.sol` contract interacts with the native Ethereum staking deposit contract. For more information, see `contracts/lib/BatchDeposit.sol`.

Credits also go to [Justfarming](https://www.justfarming.xyz), [stakefish](https://www.stake.fish), and [abyss](https://www.abyss.finance) who have built their batch depositors in the open:

- [Justfarming BatchDeposit & StakingRewards](https://github.com/justfarming/contracts)
- [stakefish BatchDeposits contract (GitHub)](https://github.com/stakefish/eth2-batch-deposit/blob/main/contracts/BatchDeposits.sol)
- [Abyss Eth2 Depositor contract (GitHub)](https://github.com/abyssfinance/abyss-eth2depositor/blob/main/contracts/AbyssEth2Depositor.sol)

## Design Decisions

### The Ethereum Deposit Process

Ethereum staking deposits, i.e., `depositdata`, generated with the official [`Ethereum staking-deposit-cli`](https://github.com/ethereum/staking-deposit-cli) are flexible regarding the per-validator withdrawal credential. This implementation of batch deposits assume, and require, all validators of a batch to deposit for the same withdrawal address. This design-decision is in line with two observation-based assumptions:

1. Batches of validators are usually deployed on behalf of a single entity that usually wants all validators of one batch to be associated to the same withdrawal address.
2. People want confidence when depositing to validators: Verifying Ethereum staking deposits on hardware wallets is difficult. The stakes are high but confidence when reviewing a transaction of 100 Validator deposits with 100 different withdrawal credentials hidden in _a lot_ of hex data on a small screen.

To the latter point: This implementation helps by presenting the withdrawal address (not credential) as the first parameter of the contract, re-enabling a human to conduct the verification of the batch deposit transaction.

## Setup

The Justfaring contracts project uses the [Truffle Suite](https://trufflesuite.com/) and [Node.js with `npm`](https://nodejs.org/en) to manage its dependencies.

With `node`, you can proceed with installing the project-specific dependencies:

``` shell
npm install
```

For static analysis, [Slither](https://github.com/crytic/slither) is used as a tools for performing automated security analysis on the smart contracts.

``` shell
pip3 install slither-analyzer
```

`solc-select` is being used for managing the solidity version in use.

``` shell
pip3 install solc-select
solc-select install 0.8.21
solc-select use 0.8.21
```

## Developing

### Linting

You can lint `.js` and `.ts` files with

``` shell
npm run lint:ts
```

as well as the `.sol` files with

``` shell
npm run lint:sol
```

Most issues can be fixed with

``` shell
npm run lint:ts -- --fix
npm run fmt
```

### Analysis

To run the analyzer:

``` shell
npm run analyze
```

### Testing


To run the tests, you can run:

``` shell
npm run test
```

#### Generate test-coverage


To generate test coverage information, you can run:

``` shell
npm run test:coverage
```

#### Manual testing

Manual tests can be conducted using [`ethdo`](https://github.com/wealdtech/ethdo), which can be installed using `go`:

``` shell
go install github.com/wealdtech/ethdo@latest
```

``` shell
export ETHDO_WALLET_NAME="Justfarming Development"
export ETHDO_PASSPHRASE="Justfarming Development"
export ETHDO_MNEMONIC="..."
export ETHDO_ACCOUNT_INDEX=1
export ETHDO_CONFIG_WITHDRAWAL_ADDRESS=0x...

# Create a wallet
ethdo wallet create --wallet="${ETHDO_WALLET_NAME}" --type="hd" --wallet-passphrase="${ETHDO_PASSPHRASE}" --mnemonic="${ETHDO_MNEMONIC}" --allow-weak-passphrases

# Delete a wallet
ethdo wallet delete --wallet="${ETHDO_WALLET_NAME}"

# Create an account
ethdo account create --account="${ETHDO_WALLET_NAME}/Validators/${ETHDO_ACCOUNT_INDEX}" --wallet-passphrase="${ETHDO_PASSPHRASE}" --passphrase="${ETHDO_PASSPHRASE}" --allow-weak-passphrases --path="m/12381/3600/${ETHDO_ACCOUNT_INDEX}/0/0"

# Create deposit data for a new validator
ethdo validator depositdata --validatoraccount="${ETHDO_WALLET_NAME}/Validators/${ETHDO_ACCOUNT_INDEX}" --depositvalue="32Ether" --withdrawaladdress="${ETHDO_CONFIG_WITHDRAWAL_ADDRESS}" --passphrase="${ETHDO_PASSPHRASE}"
```

#### Integration testing

##### Local Testnet

In addition to the previously mentioned requirements, you will need the following in order to run the local testnet:

- [Setup docker](https://docs.kurtosis.com/next/install#i-install--start-docker)
- [Install kurtosis](https://docs.kurtosis.com/next/install#ii-install-the-cli)

###### Launch a local ethereum network

``` shell
kurtosis run --enclave justfarming-contracts config/localnet/main.star "$(cat ./config/localnet/params.json)"
```

Please note that you will need to wait 120 seconds until genesis.

With default settings being used, the network will run at `http://127.0.0.1:64248`.
Prefunded accounts use the following private keys ([source](https://github.com/kurtosis-tech/eth-network-package/blob/main/src/prelaunch_data_generator/genesis_constants/genesis_constants.star)):
``` md
ef5177cd0b6b21c87db5a0bf35d4084a8a57a9d6a064f86d51ac85f2b873a4e2
48fcc39ae27a0e8bf0274021ae6ebd8fe4a0e12623d61464c498900b28feb567
7988b3a148716ff800414935b305436493e1f25237a2a03e5eebc343735e2f31
b3c409b6b0b3aa5e65ab2dc1930534608239a478106acf6f3d9178e9f9b00b35
df9bb6de5d3dc59595bcaa676397d837ff49441d211878c024eabda2cd067c9f
7da08f856b5956d40a72968f93396f6acff17193f013e8053f6fbb6c08c194d6
```

###### Deploying

Find the rpc port of your locally running execution client by running
``` shell
npx hardhat update-rpc-port
# Remember to source the env
source .env
```

This command updates the local environment (`.env`) used for the `networks.localnet` configuration in [./hardhat.config.ts](/hardhat.config.ts) to use this port.

You can now deploy and interact with the contracts.

###### Interacting

There are 32 validators running, awaiting activation, with their keys derived the following mnemonic:

``` text
flee title shaft evoke stable vote injury ten strong farm obtain pause record rural device cotton hollow echo good acquire scrub buzz vacant liar
```

To deposit to one or multiple of these validators, you'll need to first create deposit data. The following examples use `ethdo` as mentioned in the testing section.


``` shell
export ETHDO_CONFIG_WALLET=Justfarming Development
export ETHDO_CONFIG_PASSPHRASE=test
export ETHDO_CONFIG_MNEMONIC="flee title shaft evoke stable vote injury ten strong farm obtain pause record rural device cotton hollow echo good acquire scrub buzz vacant liar"
export ETHDO_CONFIG_WITHDRAWAL_ADDRESS=$WITHDRAWAL_ADDRESS

ethdo wallet create --wallet="${ETHDO_CONFIG_WALLET}" --type="hd" --wallet-passphrase="${ETHDO_CONFIG_PASSPHRASE}" --mnemonic="${ETHDO_CONFIG_MNEMONIC}" --allow-weak-passphrases

for ETHDO_VALIDATOR_INDEX in {0..31}
do
    ethdo account create --account="${ETHDO_CONFIG_WALLET}/Validators/${ETHDO_VALIDATOR_INDEX}" --wallet-passphrase="${ETHDO_CONFIG_PASSPHRASE}" --passphrase="${ETHDO_CONFIG_PASSPHRASE}" --allow-weak-passphrases --path="m/12381/3600/${ETHDO_VALIDATOR_INDEX}/0/0"
    ethdo validator depositdata --validatoraccount="${ETHDO_CONFIG_WALLET}/Validators/${ETHDO_VALIDATOR_INDEX}" --depositvalue="32Ether" --withdrawaladdress="${ETHDO_CONFIG_WITHDRAWAL_ADDRESS}" --passphrase="${ETHDO_CONFIG_PASSPHRASE}" > /tmp/justfarming-local-validator-depositdata-${ETHDO_VALIDATOR_INDEX}.json
done

# Get public keys
ls /tmp/justfarming-local-validator-*.json | xargs -I {} jq -r '.[0].pubkey' {} | awk 'BEGIN{ORS=","} {print}' | sed 's/,$/\n/' > /tmp/justfarming-local-validator-pubkeys.txt

# Get signatures
ls /tmp/justfarming-local-validator-*.json | xargs -I {} jq -r '.[0].signature' {} | awk 'BEGIN{ORS=","} {print}' | sed 's/,$/\n/' > /tmp/justfarming-local-validator-signatures.txt

# Get deposit data roots
ls /tmp/justfarming-local-validator-*.json | xargs -I {} jq -r '.[0].deposit_data_root' {} | awk 'BEGIN{ORS=","} {print}' | sed 's/,$/\n/' > /tmp/justfarming-local-validator-deposit-data-roots.txt
```

You can now extract the respective depositdata from the created depositdata files in `/tmp`. For example, get the pubkeys for registering them with the BatchDeposit contract:

``` shell
# deploy the BatchDeposit contract
npx hardhat batch-deposit:deploy --network localnet --ethereum-deposit-contract-address 0x4242424242424242424242424242424242424242
# export the address afterwards: export JF_BATCH_DEPOSIT_CONTRACT_ADDRESS=0x...

# register valiadtors as available
npx hardhat batch-deposit:register-validators --network localnet --batch-deposit-contract-address $JF_BATCH_DEPOSIT_CONTRACT_ADDRESS --validator-public-keys "0x8e1b5d5d2938c6ae35445875f5a6410d8a8f6b93b486ee795632ef1cc9329849e91098a4d86108199ea9f017a4f57ce3,0x8c35be170b4741be1314e22d46e0a8ddca9d08c182bcd9f37e85a1fd1ea0d37dbcf972e13a86f2ba369066d098140694,0xb8c4b28d46a73aa82c400b7f159645b097953d37e2ca98908bc236b5b6292a6ba3a0612e8454867a3f9f38a1c8184d0f"

# validate availability of a specific validator public key
npx hardhat batch-deposit:is-validator-available --network localnet --batch-deposit-contract-address $JF_BATCH_DEPOSIT_CONTRACT_ADDRESS --validator-public-key 0x8e1b5d5d2938c6ae35445875f5a6410d8a8f6b93b486ee795632ef1cc9329849e91098a4d86108199ea9f017a4f57ce3

# validate un-availability of a specific validator public key
npx hardhat batch-deposit:is-validator-available --network localnet --batch-deposit-contract-address $JF_BATCH_DEPOSIT_CONTRACT_ADDRESS --validator-public-key 0x96b26551fa223f8509b13e651d4bde3749d93df13ca2c45f89d2d96a19cfaaf6bb6600cba7ec4f280de246479af4472d

# deposit to multiple validators
npx hardhat batch-deposit:batch-deposit --network localnet --batch-deposit-contract-address $JF_BATCH_DEPOSIT_CONTRACT_ADDRESS --withdrawal-address $WITHDRAWAL_ADDRESS --validator-public-keys "0x8e1b5d5d2938c6ae35445875f5a6410d8a8f6b93b486ee795632ef1cc9329849e91098a4d86108199ea9f017a4f57ce3,0x8c35be170b4741be1314e22d46e0a8ddca9d08c182bcd9f37e85a1fd1ea0d37dbcf972e13a86f2ba369066d098140694,0xb8c4b28d46a73aa82c400b7f159645b097953d37e2ca98908bc236b5b6292a6ba3a0612e8454867a3f9f38a1c8184d0f" --validator-signatures "..." --validator-deposit-data-roots "..."

# excute a native ethereum staking deposit
npx hardhat native-staking:deposit --network localnet --ethereum-deposit-contract-address 0x4242424242424242424242424242424242424242 --deposit-data-path /tmp/justfarming-local-validator-depositdata-16.json

# Listing all deposits
npx hardhat --network localnet debug:list-deposits --ethereum-deposit-contract-address 0x4242424242424242424242424242424242424242

# debugging a transaction
npx hardhat --network localnet debug:transaction --tx-hash 0xbc0ce66317705141485622a5c30e91f6a54fbae7a601056563887688c72e6949
```

``` bash
ls /tmp/justfarming-local-validator-*.json | xargs -I {} jq -r '.[0].pubkey' {}
```

###### Observing

You can stream the logs of these validator nodes with:
``` shell
docker logs -f $(docker ps | grep justfarming-lighthouse-validator | awk '{print $1}' | tr -d '\n')
```

this is especially helpful for observing validators become active upon using `BatchDepoit.sol`.

You can use `ethdo` to inspect validators:

``` shell
# Get general chain info
ethdo --connection=http://localhost:$CL_RPC_PORT chain info

# Get info about validator #1
ethdo --connection=http://localhost:$CL_RPC_PORT validator info --validator 0x8e1b5d5d2938c6ae35445875f5a6410d8a8f6b93b486ee795632ef1cc9329849e91098a4d86108199ea9f017a4f57ce3
ethdo --connection=http://localhost:$CL_RPC_PORT validator info --validator 0x8c35be170b4741be1314e22d46e0a8ddca9d08c182bcd9f37e85a1fd1ea0d37dbcf972e13a86f2ba369066d098140694
ethdo --connection=http://localhost:$CL_RPC_PORT validator info --validator 0xb8c4b28d46a73aa82c400b7f159645b097953d37e2ca98908bc236b5b6292a6ba3a0612e8454867a3f9f38a1c8184d0f
```

###### Cleanup

Remember to clean up when you are done.

``` shell
# Clean up kurtosis
kurtosis clean -a

# Remove the development wallet
ethdo wallet delete --wallet="${ETHDO_CONFIG_WALLET}"
```

## Deployment

To deploy the contracts to a network:

``` shell
npx hardhat ...
```

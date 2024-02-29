import { ethers } from "hardhat";
import { execSync } from "child_process";
import { expect } from "chai";

const ETHDO_CONFIG = {
  wallet: "Justfarming Development",
  passphrase: "test",
  mnemonic:
    "giant issue aisle success illegal bike spike question tent bar rely arctic volcano long crawl hungry vocal artwork sniff fantasy very lucky have athlete",
};
const CMD_CREATE_WALLET = `ethdo wallet create --wallet="${ETHDO_CONFIG.wallet}" --type="hd" --wallet-passphrase="${ETHDO_CONFIG.passphrase}" --mnemonic="${ETHDO_CONFIG.mnemonic}" --allow-weak-passphrases`;
const CMD_DELETE_WALLET = `ethdo wallet delete --wallet="${ETHDO_CONFIG.wallet}"`;
const CMD_CREATE_ACCOUNT = (index: number) =>
  `ethdo account create --account="${ETHDO_CONFIG.wallet}/Validators/${index}" --wallet-passphrase="${ETHDO_CONFIG.passphrase}" --passphrase="${ETHDO_CONFIG.passphrase}" --allow-weak-passphrases --path="m/12381/3600/${index}/0/0"`;
const CMD_CREATE_DEPOSIT_DATA = (index: number, withdrawalAddress: string) =>
  `ethdo validator depositdata --validatoraccount="${ETHDO_CONFIG.wallet}/Validators/${index}" --depositvalue="32Ether" --withdrawaladdress="${withdrawalAddress}" --passphrase="${ETHDO_CONFIG.passphrase}"`;

type EthdoDepositData = {
  name: string;
  account: string;
  pubkey: string;
  withdrawal_credentials: string;
  signature: string;
  amount: number;
  deposit_data_root: string;
  deposit_message_root: string;
  fork_version: string;
  version: number;
};

type ValidatorDepositSet = {
  amount: number;
  depositDataRoots: string[];
  pubkeys: string[];
  signatures: string[];
  withdrawalAddress: string;
};

function createValidatorDeposits(
  withdrawalAddress: string,
  numberOfValidators: number,
): ValidatorDepositSet {
  const depositDataRoots: string[] = [];
  const pubkeys: string[] = [];
  const signatures: string[] = [];

  try {
    execSync(CMD_CREATE_WALLET);
  } catch (error) {
    console.error(`Failed to create wallet`);
    throw error;
  }

  for (let i = 0; i < numberOfValidators; i += 1) {
    execSync(CMD_CREATE_ACCOUNT(i));
    try {
      const rawEthdoDepositData = execSync(
        CMD_CREATE_DEPOSIT_DATA(i, withdrawalAddress),
      );
      const ethdoDepositData = JSON.parse(
        rawEthdoDepositData.toString(),
      )[0] as EthdoDepositData;

      pubkeys.push(ethdoDepositData.pubkey);
      signatures.push(ethdoDepositData.signature);
      depositDataRoots.push(ethdoDepositData.deposit_data_root);
    } catch (error) {
      console.error(`Failed to create deposit data for validator ${i}`);
      execSync(CMD_DELETE_WALLET);
      throw error;
    }
  }

  try {
    execSync(CMD_DELETE_WALLET);
  } catch (error) {
    console.error(`Failed to delete wallet`);
    throw error;
  }

  return {
    amount: ethers.parseEther((32 * numberOfValidators).toString(), "wei"),
    depositDataRoots,
    pubkeys,
    signatures,
    withdrawalAddress,
  };
}

describe("BatchDeposit", async () => {
  beforeEach(async function () {
    const [_deployer] = await ethers.getSigners();

    this.ethereumStakingDepositContract = await ethers.deployContract(
      "DepositContract",
      [],
      {
        value: 0,
      },
    );

    await this.ethereumStakingDepositContract.waitForDeployment();

    this.batchDepositContract = await ethers.deployContract(
      "BatchDeposit",
      [this.ethereumStakingDepositContract.target],
      { value: 0 },
    );

    await this.batchDepositContract.waitForDeployment();
  });

  describe("not payable", async () => {
    it("throws a custom error `NotPayable` when trying to send ETH", async function () {
      const [_deployer, _justfarmingFeeWallet, _customer, randomUser] =
        await ethers.getSigners();

      await expect(
        randomUser.sendTransaction({
          to: this.batchDepositContract.target,
          value: ethers.parseEther("1.0"),
        }),
      ).to.be.revertedWithCustomError(this.batchDepositContract, "NotPayable");
    });
  });

  describe("batch deposits", async () => {
    it("can perform multiple deposits in one tx", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 3;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      const res = await this.batchDepositContract
        .connect(payee1)
        .batchDeposit(
          validatorDeposits.withdrawalAddress,
          validatorDeposits.pubkeys,
          validatorDeposits.signatures,
          validatorDeposits.depositDataRoots,
          {
            value: validatorDeposits.amount,
          },
        );

      const expectedPaymentAmount = ethers.parseEther(
        (32 * numberOfNodes).toString(),
        "wei",
      );
      await expect(res).to.changeEtherBalance(payee1, -expectedPaymentAmount);
      await expect(res).to.changeEtherBalance(
        this.batchDepositContract.target,
        0,
      );
      await expect(res).to.changeEtherBalance(
        this.ethereumStakingDepositContract.target,
        expectedPaymentAmount,
      );
    });

    it("reverts if transaction value is too low", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const amountWei = ethers.parseEther("1", "wei");
      const validatorDeposits = createValidatorDeposits(rewardsAddress, 1);

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            validatorDeposits.pubkeys,
            validatorDeposits.signatures,
            validatorDeposits.depositDataRoots,
            {
              value: amountWei,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "InvalidTransactionAmount",
      );
    });

    it("reverts if transaction value is too high", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const amountWei = ethers.parseEther("100", "wei");
      const validatorDeposits = createValidatorDeposits(rewardsAddress, 1);

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            validatorDeposits.pubkeys,
            validatorDeposits.signatures,
            validatorDeposits.depositDataRoots,
            {
              value: amountWei,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "InvalidTransactionAmount",
      );
    });

    it("reverts if the number of pubkeys does not match the number of signatures", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 3;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            validatorDeposits.pubkeys,
            validatorDeposits.signatures.slice(0, 1),
            validatorDeposits.depositDataRoots,
            {
              value: validatorDeposits.amount,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "SignaturesLengthMismatch",
      );
    });

    it("reverts if the number of pubkeys does not match the number of deposit data roots", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 3;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            validatorDeposits.pubkeys,
            validatorDeposits.signatures,
            validatorDeposits.depositDataRoots.slice(0, 1),
            {
              value: validatorDeposits.amount,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "DepositDataRootsLengthMismatch",
      );
    });

    it("reverts if a public key is invalid", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 2;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            [validatorDeposits.pubkeys[0], "0x0000"],
            validatorDeposits.signatures,
            validatorDeposits.depositDataRoots,
            {
              value: validatorDeposits.amount,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "PublicKeyLengthMismatch",
      );
    });

    it("reverts if a signature is invalid", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 2;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      await expect(
        this.batchDepositContract
          .connect(payee1)
          .batchDeposit(
            validatorDeposits.withdrawalAddress,
            validatorDeposits.pubkeys,
            [validatorDeposits.signatures[0], "0x0000"],
            validatorDeposits.depositDataRoots,
            {
              value: validatorDeposits.amount,
            },
          ),
      ).to.be.revertedWithCustomError(
        this.batchDepositContract,
        "SignatureLengthMismatch",
      );
    });

    it("updates the available validators after a successful deposit", async function () {
      const [_owner, payee1, rewardsWallet] = await ethers.getSigners();
      const rewardsAddress = await rewardsWallet.getAddress();
      const numberOfNodes = 3;
      const validatorDeposits = createValidatorDeposits(
        rewardsAddress,
        numberOfNodes,
      );

      await this.batchDepositContract
        .connect(payee1)
        .batchDeposit(
          validatorDeposits.withdrawalAddress,
          validatorDeposits.pubkeys.slice(0, 1),
          validatorDeposits.signatures.slice(0, 1),
          validatorDeposits.depositDataRoots.slice(0, 1),
          {
            value: ethers.parseEther((32 * 1).toString()),
          },
        );

      await this.batchDepositContract
        .connect(payee1)
        .batchDeposit(
          validatorDeposits.withdrawalAddress,
          validatorDeposits.pubkeys.slice(1, 3),
          validatorDeposits.signatures.slice(1, 3),
          validatorDeposits.depositDataRoots.slice(1, 3),
          {
            value: ethers.parseEther((32 * 2).toString()),
          },
        );
    });
  });
});

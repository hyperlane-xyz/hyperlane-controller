import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { InterchainGasPaymaster, Outbox } from "@abacus-network/core";
import { hardhatMultiProvider } from "@abacus-network/hardhat";
import { TestCoreApp } from "@abacus-network/hardhat/dist/src/TestCoreApp";
import { TestCoreDeploy } from "@abacus-network/hardhat/dist/src/TestCoreDeploy";
import {
  chainMetadata,
  MultiProvider,
  objMap,
  TestChainNames,
} from "@abacus-network/sdk";
import { utils } from "@abacus-network/utils";

import { ControllerRouter, TestSet, TestSet__factory } from "./types";

import { ControllerDeployer } from "./deploy";
import { formatCall, increaseTimestampBy } from "./utils";

const recoveryTimelock = 60 * 60 * 24 * 7;
const chains: TestChainNames[] = ["test1", "test2", "test3"];
const [localChain, remoteChain] = chains;
const domains = chains.map((chain) => chainMetadata[chain].id);
const [, remoteDomain] = domains;
const testDomain = remoteDomain * 2;
const ONLY_OWNER_REVERT_MESSAGE = "Ownable: caller is not the owner";

describe("ControllerRouter", async () => {
  let controller: SignerWithAddress,
    recoveryManager: SignerWithAddress,
    router: ControllerRouter,
    remote: ControllerRouter,
    testSet: TestSet,
    controllerDeploy: ControllerDeployer<TestChainNames>,
    outbox: Outbox,
    interchainGasPaymaster: InterchainGasPaymaster,
    multiProvider: MultiProvider<TestChainNames>,
    core: TestCoreApp;
  const testInterchainGasPayment = 123456789;

  before(async () => {
    [controller, recoveryManager] = await ethers.getSigners();

    multiProvider = hardhatMultiProvider(ethers.provider, controller);
    const deployer = new TestCoreDeploy(multiProvider);
    core = await deployer.deployCore();

    const testSetFactory = new TestSet__factory(controller);
    testSet = await testSetFactory.deploy();

    const controllerConfig = objMap(core.contractsMap, (chain) => ({
        recoveryTimelock,
        recoveryManager: recoveryManager.address,
        owner: chain === localChain ? controller.address : ethers.constants.AddressZero
      })
    );

    controllerDeploy = new ControllerDeployer(multiProvider, core.extendWithConnectionManagers(controllerConfig));
  });

  beforeEach(async () => {
    const contractsMap = await controllerDeploy.deploy();
    router = contractsMap[localChain].router.contract
    remote = contractsMap[remoteChain].router.contract
    outbox = core.getContracts(localChain).outbox.contract;
    interchainGasPaymaster =
      core.getContracts(localChain).interchainGasPaymaster;
  });

  it("Cannot be initialized twice", async () => {
    await expect(
      router.initialize(ethers.constants.AddressZero)
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  describe("when not in recovery mode", async () => {
    it("controller is the owner", async () => {
      expect(await router.owner()).to.equal(controller.address);
    });

    it("controller can set local recovery manager", async () => {
      expect(await router.recoveryManager()).to.equal(recoveryManager.address);
      await router.transferOwnership(router.address);
      expect(await router.recoveryManager()).to.equal(router.address);
      expect(await router.recoveryActiveAt()).to.equal(0);
    });

    it("controller can make local calls", async () => {
      const value = 12;
      const call = formatCall(testSet, "set", [value]);
      await router.call([call]);
      expect(await testSet.get()).to.equal(value);
    });

    it("controller can set local controller", async () => {
      expect(await router.controller()).to.equal(controller.address);
      await router.setController(ethers.constants.AddressZero);
      expect(await router.controller()).to.equal(ethers.constants.AddressZero);
    });

    it("controller can set local abacusConnectionManager", async () => {
      expect(await router.abacusConnectionManager()).to.equal(
        core.getContracts(localChain).abacusConnectionManager.address
      );
      await router.setAbacusConnectionManager(ethers.constants.AddressZero);
      expect(await router.abacusConnectionManager()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("controller can enroll local remote router", async () => {
      expect(await router.routers(testDomain)).to.equal(
        ethers.constants.HashZero
      );
      const newRouter = utils.addressToBytes32(router.address);
      await router.enrollRemoteRouter(testDomain, newRouter);
      expect(await router.routers(testDomain)).to.equal(newRouter);
    });

    it("controller can make remote calls", async () => {
      const value = 13;
      const call = formatCall(testSet, "set", [value]);
      await router.callRemote(remoteDomain, [call]);
      await core.processMessages();
      expect(await testSet.get()).to.equal(value);
    });

    it("allows interchain gas payment for remote calls", async () => {
      const leafIndex = await outbox.count();
      const value = 13;
      const call = formatCall(testSet, "set", [value]);
      await expect(
        await router.callRemote(remoteDomain, [call], {
          value: testInterchainGasPayment,
        })
      )
        .to.emit(interchainGasPaymaster, "GasPayment")
        .withArgs(leafIndex, testInterchainGasPayment);
    });

    it("controller can set remote controller", async () => {
      const newController = controller.address;
      expect(await remote.controller()).to.not.equal(newController);
      await router.setControllerRemote(remoteDomain, newController);
      await core.processMessages();
      expect(await remote.controller()).to.equal(newController);
    });

    it("allows interchain gas payment when setting a remote controller", async () => {
      const newController = controller.address;
      const leafIndex = await outbox.count();
      await expect(
        router.setControllerRemote(remoteDomain, newController, {
          value: testInterchainGasPayment,
        })
      )
        .to.emit(interchainGasPaymaster, "GasPayment")
        .withArgs(leafIndex, testInterchainGasPayment);
    });

    it("controller can set remote abacusConnectionManager", async () => {
      const newConnectionManager = ethers.constants.AddressZero;
      expect(await remote.abacusConnectionManager()).to.not.equal(
        newConnectionManager
      );
      await router.setAbacusConnectionManagerRemote(
        remoteDomain,
        newConnectionManager
      );
      await core.processMessages();
      expect(await remote.abacusConnectionManager()).to.equal(
        newConnectionManager
      );
    });

    it("allows interchain gas payment when setting a remote abacusConnectionManager", async () => {
      const leafIndex = await outbox.count();
      await expect(
        router.setAbacusConnectionManagerRemote(
          remoteDomain,
          ethers.constants.AddressZero,
          { value: testInterchainGasPayment }
        )
      )
        .to.emit(interchainGasPaymaster, "GasPayment")
        .withArgs(leafIndex, testInterchainGasPayment);
    });

    it("controller can enroll remote remote router", async () => {
      expect(await remote.routers(testDomain)).to.equal(
        ethers.constants.HashZero
      );
      const newRouter = utils.addressToBytes32(router.address);
      await router.enrollRemoteRouterRemote(
        remoteDomain,
        testDomain,
        newRouter
      );
      await core.processMessages();
      expect(await remote.routers(testDomain)).to.equal(newRouter);
    });

    it("allows interchain gas payment when enrolling a remote router", async () => {
      const leafIndex = await outbox.count();
      const newRouter = utils.addressToBytes32(router.address);
      await expect(
        router.enrollRemoteRouterRemote(remoteDomain, testDomain, newRouter, {
          value: testInterchainGasPayment,
        })
      )
        .to.emit(interchainGasPaymaster, "GasPayment")
        .withArgs(leafIndex, testInterchainGasPayment);
    });

    it("controller cannot initiate recovery", async () => {
      await expect(router.initiateRecoveryTimelock()).to.be.revertedWith(
        "!recoveryManager"
      );
    });

    it("controller cannot exit recovery", async () => {
      await expect(router.exitRecovery()).to.be.revertedWith("!recovery");
    });

    it("recoveryManager can set local recovery manager", async () => {
      expect(await router.recoveryManager()).to.equal(recoveryManager.address);
      await router.connect(recoveryManager).transferOwnership(router.address);
      expect(await router.recoveryManager()).to.equal(router.address);
      expect(await router.recoveryActiveAt()).to.equal(0);
    });

    it("recovery manager cannot make local calls", async () => {
      const value = 12;
      const call = formatCall(testSet, "set", [value]);
      await expect(
        router.connect(recoveryManager).call([call])
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("recovery manager cannot set local controller", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .setController(ethers.constants.AddressZero)
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("recovery manager cannot set local abacusConnectionManager", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .setAbacusConnectionManager(router.address)
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("recovery manager cannot enroll local remote router", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .enrollRemoteRouter(
            testDomain,
            utils.addressToBytes32(router.address)
          )
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("recovery manager cannot make remote calls", async () => {
      const value = 13;
      const call = formatCall(testSet, "set", [value]);
      await expect(
        router.connect(recoveryManager).callRemote(remoteDomain, [call])
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot set remote controller", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .setControllerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot set remote abacusConnectionManager", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .setAbacusConnectionManagerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot enroll remote remote router", async () => {
      await expect(
        router
          .connect(recoveryManager)
          .enrollRemoteRouterRemote(
            testDomain,
            testDomain,
            utils.addressToBytes32(router.address)
          )
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager can initiate recovery", async () => {
      await expect(
        router.connect(recoveryManager).initiateRecoveryTimelock()
      ).to.emit(router, "InitiateRecovery");
    });

    it("recovery manager cannot exit recovery", async () => {
      await expect(
        router.connect(recoveryManager).exitRecovery()
      ).to.be.revertedWith("!recovery");
    });
  });

  describe("when in recovery mode", async () => {
    beforeEach(async () => {
      router = router.connect(recoveryManager);
      await router.initiateRecoveryTimelock();
      expect(await router.inRecovery()).to.be.false;
      await increaseTimestampBy(ethers.provider, recoveryTimelock);
      expect(await router.inRecovery()).to.be.true;
    });

    it("recovery manager is the owner", async () => {
      expect(await router.owner()).to.equal(recoveryManager.address);
    });

    it("recovery manager can set local recovery manager", async () => {
      const recoveryActiveAt = await router.recoveryActiveAt();
      expect(await router.recoveryManager()).to.equal(recoveryManager.address);
      await router.transferOwnership(router.address);
      expect(await router.recoveryManager()).to.equal(router.address);
      expect(await router.recoveryActiveAt()).to.equal(recoveryActiveAt);
    });

    it("recovery manager can make local calls", async () => {
      const value = 12;
      const call = formatCall(testSet, "set", [value]);
      await router.call([call]);
      expect(await testSet.get()).to.equal(value);
    });

    it("recovery manager can set local controller", async () => {
      expect(await router.controller()).to.equal(controller.address);
      await router.setController(ethers.constants.AddressZero);
      expect(await router.controller()).to.equal(ethers.constants.AddressZero);
    });

    it("recovery manager can set local abacusConnectionManager", async () => {
      expect(await router.abacusConnectionManager()).to.equal(
        core.getContracts(localChain).abacusConnectionManager.address
      );
      await router.setAbacusConnectionManager(ethers.constants.AddressZero);
      expect(await router.abacusConnectionManager()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("recovery manager can enroll local remote router", async () => {
      expect(await router.routers(testDomain)).to.equal(
        ethers.constants.HashZero
      );
      const newRouter = utils.addressToBytes32(router.address);
      await router.enrollRemoteRouter(testDomain, newRouter);
      expect(await router.routers(testDomain)).to.equal(newRouter);
    });

    it("recovery manager cannot make remote calls", async () => {
      const value = 13;
      const call = formatCall(testSet, "set", [value]);
      await expect(router.callRemote(remoteDomain, [call])).to.be.revertedWith(
        "!controller"
      );
    });

    it("recovery manager cannot set remote controller", async () => {
      await expect(
        router.setControllerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot set remote abacusConnectionManager", async () => {
      await expect(
        router.setAbacusConnectionManagerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot enroll remote remote router", async () => {
      await expect(
        router.enrollRemoteRouterRemote(
          remoteDomain,
          testDomain,
          utils.addressToBytes32(router.address)
        )
      ).to.be.revertedWith("!controller");
    });

    it("recovery manager cannot initiate recovery", async () => {
      await expect(router.initiateRecoveryTimelock()).to.be.revertedWith(
        "recovery"
      );
    });

    it("recovery manager can exit recovery ", async () => {
      await expect(router.exitRecovery()).to.emit(router, "ExitRecovery");
      expect(await router.inRecovery()).to.be.false;
    });

    it("controller cannot make local calls", async () => {
      const value = 12;
      const call = formatCall(testSet, "set", [value]);
      await expect(router.connect(controller).call([call])).to.be.revertedWith(
        ONLY_OWNER_REVERT_MESSAGE
      );
    });

    it("controller cannot set local controller", async () => {
      await expect(
        router.connect(controller).setController(ethers.constants.AddressZero)
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("controller cannot set local recovery manager", async () => {
      await expect(
        router.connect(controller).transferOwnership(router.address)
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("controller cannot set local abacusConnectionManager", async () => {
      await expect(
        router.connect(controller).setAbacusConnectionManager(router.address)
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("controller cannot enroll local remote router", async () => {
      await expect(
        router
          .connect(controller)
          .enrollRemoteRouter(
            testDomain,
            utils.addressToBytes32(router.address)
          )
      ).to.be.revertedWith(ONLY_OWNER_REVERT_MESSAGE);
    });

    it("controller cannot make remote calls", async () => {
      const value = 13;
      const call = formatCall(testSet, "set", [value]);
      await expect(
        router.connect(controller).callRemote(remoteDomain, [call])
      ).to.be.revertedWith("recovery");
    });

    it("controller cannot set remote controller", async () => {
      await expect(
        router
          .connect(controller)
          .setControllerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("recovery");
    });

    it("controller cannot set remote abacusConnectionManager", async () => {
      await expect(
        router
          .connect(controller)
          .setAbacusConnectionManagerRemote(remoteDomain, router.address)
      ).to.be.revertedWith("recovery");
    });

    it("controller cannot enroll remote remote router", async () => {
      await expect(
        router
          .connect(controller)
          .enrollRemoteRouterRemote(
            remoteDomain,
            testDomain,
            utils.addressToBytes32(router.address)
          )
      ).to.be.revertedWith("recovery");
    });

    it("controller cannot initiate recovery", async () => {
      await expect(
        router.connect(controller).initiateRecoveryTimelock()
      ).to.be.revertedWith("recovery");
    });

    it("controller cannot exit recovery", async () => {
      await expect(
        router.connect(controller).exitRecovery()
      ).to.be.revertedWith("!recoveryManager");
    });
  });
});

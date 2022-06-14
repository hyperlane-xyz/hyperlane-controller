import { AbacusCore, chainConnectionConfigs, MultiProvider, objMap, serializeContracts } from '@abacus-network/sdk';
import { ethers } from 'hardhat';
import { ControllerDeployer } from '../src/deploy';


const {
  alfajores,
  kovan,
  bsctestnet,
  optimismkovan,
  arbitrumrinkeby,
  fuji,
  mumbai
} = chainConnectionConfigs


async function main() {
  const signer = new ethers.Wallet('')

  const multiProvider = new MultiProvider(objMap({ alfajores, kovan, bsctestnet,
    optimismkovan,
    arbitrumrinkeby,
    fuji,
    mumbai}, (_, config) => ({
    ...config,
    signer
  })))

  const core = AbacusCore.fromEnvironment('testnet', multiProvider);

  const recoveryTimelock = 60 * 60 * 24 * 7;
  const config = core.extendWithConnectionManagers(
    objMap(core.contractsMap, (chain) => ({
      recoveryTimelock,
      recoveryManager: signer.address,
      owner:
        chain === "alfajores" ? signer.address : ethers.constants.AddressZero,
    }))
  );


  const deployer = new ControllerDeployer(
    multiProvider,
    config
  );
  const contracts = await deployer.deploy();

  console.log(serializeContracts(contracts))
}

main().catch(console.error);

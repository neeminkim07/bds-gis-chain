// Deploy script cho Hardhat local node
// Chạy: npx hardhat run scripts/deploy.js --network localhost
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying PropertyRegistry with account:', deployer.address);

  const Factory = await ethers.getContractFactory('PropertyRegistry');
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log('✔ PropertyRegistry deployed to:', address);

  // Lưu thông tin deployment vào contracts/deployed-address.json
  const deployInfo = {
    address,
    deployer: deployer.address,
    network: 'localhost',
    chainId: 31337,
    deployedAt: new Date().toISOString(),
  };
  const deployPath = path.join(__dirname, '..', 'deployed-address.json');
  fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log('✔ Saved deployment info to:', deployPath);

  // Tự động cập nhật CONTRACT_ADDRESS vào backend/.env nếu có
  const backendEnvPath = path.join(__dirname, '..', '..', 'backend', '.env');
  if (fs.existsSync(backendEnvPath)) {
    let envContent = fs.readFileSync(backendEnvPath, 'utf8');
    if (envContent.includes('CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${address}`);
    } else {
      envContent += `\nCONTRACT_ADDRESS=${address}\n`;
    }
    if (!envContent.includes('BLOCKCHAIN_RPC_URL=')) {
      envContent += `BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545\n`;
    }
    fs.writeFileSync(backendEnvPath, envContent);
    console.log('✔ Updated CONTRACT_ADDRESS in backend/.env');
  }
}

main().catch((err) => {
  console.error('Lỗi khi deploy:', err);
  process.exit(1);
});

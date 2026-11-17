// Deploy script dùng Hardhat Ignition.
// Chạy:
//   1. Mở terminal riêng: npx hardhat node            (giữ nút blockchain local)
//   2. Deploy:             npx hardhat ignition deploy ignition/modules/PropertyRegistry.js --network localhost
//
// Sau khi deploy, địa chỉ contract sẽ hiện trong output và lưu ở
// ignition/deployments/chain-31337/. Copy địa chỉ vào backend/.env

const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('PropertyRegistryModule', (m) => {
  // Deploy contract PropertyRegistry (không cần tham số constructor)
  const registry = m.contract('PropertyRegistry');
  return { registry };
});

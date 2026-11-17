// Test Smart Contract PropertyRegistry
// Chạy: npx hardhat test
// Ba trường hợp chính theo yêu cầu đồ án:
//   1. Đăng ký thành công
//   2. Người không có quyền bị từ chối
//   3. Truy xuất lịch sử đúng thứ tự

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('PropertyRegistry', function () {
  let registry;      // Instance của contract
  let owner;         // Tài khoản deploy (có quyền ghi)
  let writer;        // Tài khoản được cấp quyền ghi
  let stranger;      // Tài khoản không có quyền

  // Deploy contract mới trước mỗi test để đảm bảo trạng thái sạch
  beforeEach(async function () {
    [owner, writer, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('PropertyRegistry');
    registry = await Factory.deploy();
  });

  // ─── Nhóm 1: Quyền ghi ──────────────────────────────────────────

  describe('Quản lý quyền ghi', function () {
    it('Owner tự động là writer sau khi deploy', async function () {
      expect(await registry.writers(owner.address)).to.equal(true);
    });

    it('Owner có thể cấp quyền ghi cho địa chỉ khác', async function () {
      await registry.setWriter(writer.address, true);
      expect(await registry.writers(writer.address)).to.equal(true);
    });

    it('Owner có thể thu hồi quyền ghi', async function () {
      await registry.setWriter(writer.address, true);
      await registry.setWriter(writer.address, false);
      expect(await registry.writers(writer.address)).to.equal(false);
    });

    it('Người không phải owner không thể cấp quyền ghi', async function () {
      await expect(
        registry.connect(stranger).setWriter(stranger.address, true)
      ).to.be.revertedWith('Chi owner moi duoc goi');
    });
  });

  // ─── Nhóm 2: Đăng ký phiên bản ──────────────────────────────────

  describe('Đăng ký phiên bản thành công', function () {
    // Hash mẫu giả lập SHA-256 (32 bytes)
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('BDS001-version-1'));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('BDS001-version-2'));

    it('Owner có thể đăng ký phiên bản đầu tiên', async function () {
      const tx = await registry.registerVersion('BDS001', hash1);
      const receipt = await tx.wait();

      // Kiểm tra event được phát ra
      const event = receipt.logs.find(
        (log) => registry.interface.parseLog(log)?.name === 'VersionRegistered'
      );
      expect(event).to.not.be.undefined;

      // Kiểm tra dữ liệu trả về
      const [dataHash, versionNumber] = await registry.getLatest('BDS001');
      expect(dataHash).to.equal(hash1);
      expect(versionNumber).to.equal(1n);
    });

    it('Writer được cấp quyền có thể đăng ký', async function () {
      await registry.setWriter(writer.address, true);
      await registry.connect(writer).registerVersion('BDS002', hash1);

      const [, , , registeredBy] = await registry.getLatest('BDS002');
      expect(registeredBy).to.equal(writer.address);
    });

    it('getHistoryCount trả về đúng số phiên bản', async function () {
      await registry.registerVersion('BDS001', hash1);
      await registry.registerVersion('BDS001', hash2);

      expect(await registry.getHistoryCount('BDS001')).to.equal(2n);
    });

    it('Mã BĐS chưa đăng ký có historyCount = 0', async function () {
      expect(await registry.getHistoryCount('KHONG_TON_TAI')).to.equal(0n);
    });
  });

  // ─── Nhóm 3: Từ chối người không có quyền ───────────────────────

  describe('Từ chối người không có quyền ghi', function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('unauthorized'));

    it('Stranger không thể đăng ký phiên bản', async function () {
      await expect(
        registry.connect(stranger).registerVersion('BDS001', hash1)
      ).to.be.revertedWith('Khong co quyen ghi');
    });

    it('Writer bị thu hồi quyền không thể ghi tiếp', async function () {
      await registry.setWriter(writer.address, true);
      await registry.connect(writer).registerVersion('BDS001', hash1);

      // Thu hồi quyền
      await registry.setWriter(writer.address, false);

      await expect(
        registry.connect(writer).registerVersion('BDS001', hash1)
      ).to.be.revertedWith('Khong co quyen ghi');
    });
  });

  // ─── Nhóm 4: Truy xuất lịch sử đúng thứ tự ─────────────────────

  describe('Truy xuất lịch sử đúng thứ tự', function () {
    const hashes = [
      ethers.keccak256(ethers.toUtf8Bytes('v1-data')),
      ethers.keccak256(ethers.toUtf8Bytes('v2-data')),
      ethers.keccak256(ethers.toUtf8Bytes('v3-data')),
    ];

    beforeEach(async function () {
      // Đăng ký 3 phiên bản cho BDS001
      for (const h of hashes) {
        await registry.registerVersion('BDS001', h);
      }
    });

    it('getVersion(1) trả phiên bản đầu tiên', async function () {
      const [dataHash, versionNumber] = await registry.getVersion('BDS001', 1);
      expect(dataHash).to.equal(hashes[0]);
      expect(versionNumber).to.equal(1n);
    });

    it('getVersion(3) trả phiên bản cuối cùng', async function () {
      const [dataHash, versionNumber] = await registry.getVersion('BDS001', 3);
      expect(dataHash).to.equal(hashes[2]);
      expect(versionNumber).to.equal(3n);
    });

    it('getLatest trả phiên bản mới nhất (v3)', async function () {
      const [dataHash, versionNumber] = await registry.getLatest('BDS001');
      expect(dataHash).to.equal(hashes[2]);
      expect(versionNumber).to.equal(3n);
    });

    it('getVersion(0) revert vì phiên bản bắt đầu từ 1', async function () {
      await expect(
        registry.getVersion('BDS001', 0)
      ).to.be.revertedWith('Phien ban bat dau tu 1');
    });

    it('getVersion(99) revert vì phiên bản không tồn tại', async function () {
      await expect(
        registry.getVersion('BDS001', 99)
      ).to.be.revertedWith('Phien ban khong ton tai');
    });

    it('getLatest cho mã chưa đăng ký revert', async function () {
      await expect(
        registry.getLatest('KHONG_CO')
      ).to.be.revertedWith('Chua co phien ban nao');
    });

    it('Lịch sử nhiều mã BĐS độc lập nhau', async function () {
      // BDS002 chỉ có 1 phiên bản
      const otherHash = ethers.keccak256(ethers.toUtf8Bytes('bds002-v1'));
      await registry.registerVersion('BDS002', otherHash);

      expect(await registry.getHistoryCount('BDS001')).to.equal(3n);
      expect(await registry.getHistoryCount('BDS002')).to.equal(1n);

      const [h1] = await registry.getLatest('BDS002');
      expect(h1).to.equal(otherHash);
    });
  });
});

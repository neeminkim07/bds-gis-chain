// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PropertyRegistry
 * @notice Lưu hash SHA-256 của hồ sơ bất động sản lên blockchain.
 *         Mỗi mã BĐS có danh sách phiên bản; mỗi phiên bản gồm hash,
 *         số phiên bản, thời điểm ghi và địa chỉ người ghi.
 *         Chỉ lưu hash, KHÔNG lưu dữ liệu cá nhân trên chain.
 *
 * @dev Quyền ghi được quản lý bằng mapping `writers`.
 *      Owner (người deploy) tự động có quyền ghi và có thể cấp/thu hồi
 *      quyền ghi cho các địa chỉ khác (ví dụ backend server).
 */
contract PropertyRegistry {

    // ── Cấu trúc dữ liệu ──────────────────────────────────────────────

    /// @notice Một phiên bản hồ sơ đã đăng ký trên chain
    struct Version {
        bytes32  dataHash;      // Hash SHA-256 của dữ liệu hồ sơ chuẩn hóa
        uint256  versionNumber; // Số phiên bản: 1, 2, 3, ...
        uint256  timestamp;     // block.timestamp khi ghi
        address  registeredBy;  // Địa chỉ ví đã ghi phiên bản này
    }

    // ── Biến trạng thái ────────────────────────────────────────────────

    /// @notice Địa chỉ chủ sở hữu contract (người deploy)
    address public owner;

    /// @notice Danh sách địa chỉ được phép ghi (bao gồm owner)
    mapping(address => bool) public writers;

    /// @notice Danh sách phiên bản cho từng mã BĐS
    /// @dev    Key là keccak256(code) để tiết kiệm gas, không lưu chuỗi thô
    mapping(bytes32 => Version[]) private _versions;

    // ── Sự kiện ────────────────────────────────────────────────────────

    /// @notice Phát ra khi một phiên bản mới được đăng ký thành công
    event VersionRegistered(
        string  indexed code,       // Mã BĐS (indexed để lọc theo code)
        bytes32 dataHash,           // Hash dữ liệu
        uint256 versionNumber,      // Số phiên bản
        uint256 timestamp,          // Thời điểm ghi
        address registeredBy        // Người ghi
    );

    /// @notice Phát ra khi quyền ghi được cấp hoặc thu hồi
    event WriterUpdated(address indexed account, bool allowed);

    // ── Modifier ───────────────────────────────────────────────────────

    /// @dev Chỉ owner mới được gọi
    modifier onlyOwner() {
        require(msg.sender == owner, "Chi owner moi duoc goi");
        _;
    }

    /// @dev Chỉ địa chỉ có quyền ghi mới được gọi
    modifier onlyWriter() {
        require(writers[msg.sender], "Khong co quyen ghi");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────

    /// @notice Deploy contract, người deploy tự động là owner và writer
    constructor() {
        owner = msg.sender;
        writers[msg.sender] = true;
    }

    // ── Quản lý quyền ghi ──────────────────────────────────────────────

    /// @notice Cấp hoặc thu hồi quyền ghi cho một địa chỉ
    /// @param account Địa chỉ cần thay đổi quyền
    /// @param allowed true = cấp quyền, false = thu hồi
    function setWriter(address account, bool allowed) external onlyOwner {
        writers[account] = allowed;
        emit WriterUpdated(account, allowed);
    }

    // ── Đăng ký phiên bản ──────────────────────────────────────────────

    /// @notice Đăng ký hash của một phiên bản hồ sơ BĐS
    /// @param code Mã bất động sản (ví dụ "BDS001")
    /// @param dataHash Hash SHA-256 của dữ liệu hồ sơ đã chuẩn hóa
    function registerVersion(string calldata code, bytes32 dataHash)
        external
        onlyWriter
    {
        // Tính key từ mã BĐS
        bytes32 key = keccak256(bytes(code));

        // Số phiên bản mới = số phiên bản cũ + 1 (bắt đầu từ 1)
        uint256 newVersion = _versions[key].length + 1;

        // Lưu phiên bản vào mảng
        _versions[key].push(Version({
            dataHash:      dataHash,
            versionNumber: newVersion,
            timestamp:     block.timestamp,
            registeredBy:  msg.sender
        }));

        // Phát event để frontend/backend có thể lắng nghe
        emit VersionRegistered(code, dataHash, newVersion, block.timestamp, msg.sender);
    }

    // ── Truy vấn ───────────────────────────────────────────────────────

    /// @notice Lấy phiên bản mới nhất của một mã BĐS
    /// @param code Mã bất động sản
    function getLatest(string calldata code)
        external
        view
        returns (bytes32 dataHash, uint256 versionNumber, uint256 timestamp, address registeredBy)
    {
        bytes32 key = keccak256(bytes(code));
        uint256 count = _versions[key].length;
        require(count > 0, "Chua co phien ban nao");

        Version storage v = _versions[key][count - 1];
        return (v.dataHash, v.versionNumber, v.timestamp, v.registeredBy);
    }

    /// @notice Lấy phiên bản thứ n của một mã BĐS (đánh số từ 1)
    /// @param code Mã bất động sản
    /// @param n Số phiên bản cần lấy (1-based)
    function getVersion(string calldata code, uint256 n)
        external
        view
        returns (bytes32 dataHash, uint256 versionNumber, uint256 timestamp, address registeredBy)
    {
        require(n >= 1, "Phien ban bat dau tu 1");
        bytes32 key = keccak256(bytes(code));
        require(n <= _versions[key].length, "Phien ban khong ton tai");

        Version storage v = _versions[key][n - 1];
        return (v.dataHash, v.versionNumber, v.timestamp, v.registeredBy);
    }

    /// @notice Đếm số phiên bản đã đăng ký cho một mã BĐS
    /// @param code Mã bất động sản
    /// @return count Số phiên bản
    function getHistoryCount(string calldata code)
        external
        view
        returns (uint256 count)
    {
        return _versions[keccak256(bytes(code))].length;
    }
}

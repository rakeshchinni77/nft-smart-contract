// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract NftCollection {
    string public name;
    string public symbol;
    uint256 public maxSupply;
    uint256 public totalSupply;
    string public baseURI;
    
    address public owner;
    bool public mintingPaused;
    
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MintingPaused(bool paused);
    
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        string memory _baseURI
    ) {
        require(_maxSupply > 0, "Max supply must be greater than 0");
        name = _name;
        symbol = _symbol;
        maxSupply = _maxSupply;
        baseURI = _baseURI;
        owner = msg.sender;
        totalSupply = 0;
        mintingPaused = false;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier whenMintingNotPaused() {
        require(!mintingPaused, "Minting is currently paused");
        _;
    }
    
    function balanceOf(address _owner) public view returns (uint256) {
        require(_owner != address(0), "Invalid address");
        return _balances[_owner];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }
    
    function mint(address to, uint256 tokenId) public onlyOwner whenMintingNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(_owners[tokenId] == address(0), "Token already exists");
        require(totalSupply < maxSupply, "Max supply reached");
        
        _owners[tokenId] = to;
        _balances[to]++;
        totalSupply++;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        require(from != address(0), "Invalid from address");
        require(to != address(0), "Cannot transfer to zero address");
        require(_owners[tokenId] == from, "Not the owner");
        require(
            msg.sender == from || msg.sender == _tokenApprovals[tokenId] || _operatorApprovals[from][msg.sender],
            "Not authorized"
        );
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        _tokenApprovals[tokenId] = address(0);
        
        emit Transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public {
        transferFrom(from, to, tokenId);
        
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(
                msg.sender,
                from,
                tokenId,
                data
            ) returns (bytes4 retval) {
                require(
                    retval == IERC721Receiver.onERC721Received.selector,
                    "ERC721Receiver rejected the token"
                );
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721Receiver not implemented");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function approve(address to, uint256 tokenId) public {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        require(msg.sender == tokenOwner || _operatorApprovals[tokenOwner][msg.sender], "Not authorized");
        
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "Cannot approve yourself");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }
    
    function isApprovedForAll(address _owner, address operator) public view returns (bool) {
        return _operatorApprovals[_owner][operator];
    }
    
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return string(abi.encodePacked(baseURI, uint2str(tokenId)));
    }
    
    function pauseMinting() public onlyOwner {
        mintingPaused = true;
        emit MintingPaused(true);
    }
    
    function unpauseMinting() public onlyOwner {
        mintingPaused = false;
        emit MintingPaused(false);
    }
    
    function setBaseURI(string calldata newBaseURI) public onlyOwner {
        baseURI = newBaseURI;
    }
    
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    function burn(uint256 tokenId) public {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        require(msg.sender == tokenOwner, "Only owner can burn");
        
        _balances[tokenOwner]--;
        delete _owners[tokenId];
        delete _tokenApprovals[tokenId];
        totalSupply--;
        
        emit Transfer(tokenOwner, address(0), tokenId);
    }
}

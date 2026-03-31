// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract DeployMockPyth is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MockPyth mockPyth = new MockPyth(600, 0); // 600s validity, 0 fee
        console.log("MockPyth deployed at:", address(mockPyth));

        vm.stopBroadcast();
    }
}

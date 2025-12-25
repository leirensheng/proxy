let child_process = require("child_process");
const { getComputerName, sendAppMsg } = require("../damai/utils");
let childProcess;

let onErrorFn = (code) => {
  if (code !== 0) {
    console.log("=======出错重启==========");
    sendAppMsg("错误", "【出错重启】proxy服务出错重启" + getComputerName(), {
      type: "error",
    });
    restartChildProcess(true);
  }
};


function listenToChild() {
  childProcess.on("exit", onErrorFn);
}

async function restartChildProcess() {
  if (childProcess) {
    childProcess.off("exit", onErrorFn);
    childProcess.kill();
  }

  childProcess = child_process.fork("./proxy.js");
  listenToChild();
}

restartChildProcess();

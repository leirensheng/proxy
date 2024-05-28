const { sleep, getValidIp, getTime } = require("./utils");
const { getSign } = require("../damai/utils");
let { fetch, ProxyAgent, request } = require("undici");

const net = require("net");
let connectionMap = {};
let damaiMobileCookieAndToken = {};

class ProxyServer {
  constructor() {
    this.ips = new Set();
    this.canUseMap = {
      damai: [], //可用
      xingqiu: [], //
      maoyan: [], //
    };
    this.idToAgent = {};
    this.createIpcServer(9999);
  }

  async getMobileCookieAndToken({ activityId, isRefresh }, connection) {
    if (damaiMobileCookieAndToken[activityId] && !isRefresh) {
      console.log("直接返回", {
        ...damaiMobileCookieAndToken[activityId],
        type: "getMobileCookieAndTokenDone",
      });
      connection.write(
        JSON.stringify({
          ...damaiMobileCookieAndToken[activityId],
          type: "getMobileCookieAndTokenDone",
        })
      );
      return;
    }
    let t = Date.now();
    let data = {
      itemId: activityId,
      platform: "8",
      comboChannel: "2",
      dmChannel: "damai@damaih5_h5",
    };
    let sign = getSign(data, t);
    console.log("sign");
    let res = await fetch(
      `https://mtop.damai.cn/h5/mtop.alibaba.damai.detail.getdetail/1.2/?jsv=2.7.2&appKey=12574478&t=${t}&sign=${sign}&api=mtop.alibaba.damai.detail.getdetail&v=1.2&H5Request=true&type=originaljson&timeout=10000&dataType=json&valueType=original&forceAntiCreep=true&AntiCreep=true&useH5=true&data=${encodeURIComponent(
        JSON.stringify(data)
      )}`,
      {
        headers: {
          accept: "application/json",
          "accept-language": "zh-CN,zh;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          "sec-ch-ua":
            '"Chromium";v="118", "Microsoft Edge";v="118", "Not=A?Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          cookie:
            "isg=BOXl0gwk7Kfswwh70IXWABsn9KEfIpm0GrZ-CefKxpwr_gVwr3CGhG_fiGKIfrFs",

          Referer: "https://m.damai.cn/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: null,
        method: "GET",
      }
    );

    let cookie = res.headers.get("Set-Cookie");
    console.log(111, cookie);
    let v1 = cookie.match(/_m_h5_tk_enc=(.*?);/)[1];
    let v2 = cookie.match(/_m_h5_tk=(.*?);/)[1];
    cookie = `_m_h5_tk_enc=${v1};_m_h5_tk=${v2}`;

    let token = v2.split("_")[0];
    damaiMobileCookieAndToken[activityId] = { cookie, token };

    connection.write(
      JSON.stringify({ token, cookie, type: "getMobileCookieAndTokenDone" })
    );
  }

  async initAgent(platform) {
    let ip = await getValidIp(this.ips, platform);
    console.log(ip);
    this.ips.add(ip);
    let options = {
      uri: "http://" + ip,
      bodyTimeout: 2000,
    };
    let agent = new ProxyAgent(options);
    agent.ip = ip;
    console.log("再用的ip有", this.ips.size);
    return agent;
  }

  async handleData(data, connection) {
    try {
      let receiveData = JSON.parse(data.toString());
      if (receiveData.getAgent) {
        await this.getAgent(receiveData, connection);
      } else if (receiveData.refreshOption) {
        await this.refreshOption(receiveData, connection);
      } else if (receiveData.proxyData) {
        await this.handleProxy(receiveData, connection);
      } else if (receiveData.stopRequest) {
        await this.stopRequest(receiveData, connection);
      } else if (receiveData.pauseProxy) {
        await this.pauseProxy(receiveData, connection);
      } else if (receiveData.removeProxyIp) {
        await this.removeProxyIp(receiveData, connection);
      } else if (receiveData.getMobileCookieAndToken) {
        await this.getMobileCookieAndToken(receiveData, connection);
      }
    } catch (e) {
      console.log(e);
    }
  }

  // 停止请求,但是保留agent
  // async stopRequest(receiveData, connection) {
  //   let { platform, uniqueId } = receiveData;
  //   let agent = this.idToAgent[uniqueId];
  //   this.canUseMap[platform].unshift(agent);
  // }

  // 时间间隔太小,暂停代理30秒
  async pauseProxy(receiveData, connection) {
    let { platform, uniqueId } = receiveData;
    let agent = this.idToAgent[uniqueId];
    console.log(`${platform}时间间隔不合适,暂停使用${agent.ip}}30秒`);
    this.idToAgent[uniqueId] = null;

    setTimeout(() => {
      console.log(`恢复使用${agent.ip}`);
      this.canUseMap[platform].unshift(agent);
    }, 30 * 1000);
    connection.write(JSON.stringify({ type: "pauseProxyDone" }));
  }

  async refreshOption(receiveData, connection) {
    let { options, uniqueId, platform } = receiveData;
    connection.options = options;
    connection.write({ type: "refreshOptionDone" });
  }

  async getAgent(receiveData, connection) {
    let { options, uniqueId, platform, valueType } = receiveData;
    connection.id = uniqueId;
    connection.platform = platform;
    connection.valueType = valueType;
    connection.options = options;

    let agent;

    if (this.canUseMap[platform].length) {
      agent = this.canUseMap[platform].pop();
      console.log("从可用的里面获取", agent.ip);
    } else {
      console.log("重新获取agent", uniqueId);
      agent = await this.initAgent(platform);
      Object.keys(this.canUseMap).forEach((onePlatform) => {
        if (onePlatform !== platform) {
          this.canUseMap[onePlatform].push(agent);
        }
      });
    }

    this.idToAgent[uniqueId] = agent;
    if (!agent.ids) {
      agent.ids = new Set();
    }
    agent.ids.add(uniqueId);

    connection.ip = agent.ip;

    connection &&
      connection.write(JSON.stringify({ type: "getAgentDone", ip: agent.ip }));
    return agent;
  }

  async handleProxy(receiveData, connection) {
    let { uniqueId, platform } = receiveData;
    let options = connection.options;

    let agent = this.idToAgent[uniqueId];
    let valueType = connection.valueType;

    if (!agent) {
      console.log(uniqueId + "竟然找不到agent", getTime());
    }
    // if (!agent) {
    //   agent = await this.getAgent({ options, uniqueId, platform }, connection);
    // }
    let res;
    try {
      let p1 = fetch(options.url, {
        ...options,
        keepalive: true,
        dispatcher: agent,
      }).then((res) => {
        if (valueType === "text") {
          return res.text();
        } else {
          return res.json();
        }
      });
      let p2 = sleep(2000);
      res = await Promise.race([p1, p2]);
      if (!res) {
        throw new Error("timeout");
      }
    } catch (e) {
      console.log("出错信息", e);
      // if (!e.message.includes("timeout")) {
      // this.removeProxyIp({ uniqueId });
      // }
      // if (!res || e.message.includes("fetch failed")) {
      // }
    }
    // console.log("相应",res)
    if (res && platform === "xingqiu") {
      try {
        let {
          data: { seatPlans },
        } = res;
        res = seatPlans.filter((one) => Number(one.canBuyCount));
      } catch (e) {
        console.log(e)
      }
    }
    connection.write(JSON.stringify({ res, type: "proxyDone" }));
  }

  //只是去掉agent,没有清理options 没有用
  // removeAgent(id, agent, platform) {
  //   delete this.idToAgent[id];
  //   Object.keys(this.canUseMap).forEach((curPlatform) => {
  //     if (platform !== curPlatform) {
  //       let arr = this.canUseMap[curPlatform];
  //       let i = arr.indexOf(agent);
  //       if (i !== -1) {
  //         arr.splice(i, 1);
  //       }
  //     }
  //   });
  //   agent.close();
  // }

  // 关闭连接
  handleEnd(connection) {
    let { id, platform } = connection;
    let agent = this.idToAgent[id];
    if (agent) {
      this.canUseMap[platform].unshift(agent);
      agent.ids.delete(id);
      delete this.idToAgent[id];
    }
    delete connection.valueType;
    delete connection.options;
    delete connection.id;
    delete connection.platform;
    connection.destroy();
    connection.write(JSON.stringify({ type: "endDone" }));
  }

  // 彻底失效; todo: 测试一个平台失效,别的不失效
  removeProxyIp(receiveData, connection) {
    let { uniqueId } = receiveData;
    let agent = this.idToAgent[uniqueId];

    if (agent) {
      Object.keys(this.canUseMap).forEach((curPlatform) => {
        let arr = this.canUseMap[curPlatform];
        let i = arr.indexOf(agent);
        if (i !== -1) {
          arr.splice(i, 1);
        }
      });

      this.ips.delete(agent.ip);
      console.log("删除一个IP后: " + agent.ip, this.ips.size);

      [...agent.ids].forEach((id) => {
        this.idToAgent[id] = null;
      });
      agent.ids = null;
      agent.close();
    }
    connection &&
      connection.write(JSON.stringify({ type: "removeProxyIpDone" }));
  }

  createIpcServer(port) {
    new Promise((resolve) => {
      var server = net.createServer((connection) => {
        let ip = connection.remoteAddress;
        if (!connectionMap[ip]) {
          connectionMap[ip] = [];
          connectionMap[ip].isHandling = false;
        }
        let target = connectionMap[ip];
        target.push(connection);

        console.log("客户端连接成功");
        connection.on("data", (data) => {
          // console.log(
          //   `收到客户端消息【${ip.replace("::ffff:", "")}】`,
          //   data.toString().replace(`"next":true,`, "")
          // );
          this.handleData(data, connection);
        });
        connection.on("end", () => {
          console.log("客户端关闭连接0");
          let i = target.indexOf(connection);
          target.splice(i, 1);

          this.handleEnd(connection);
        });
        connection.on("error", (e) => {
          console.log(e.code);
          if (e.code === "ECONNRESET") {
            console.log("客户端关闭连接1", connection.ip);
            let i = target.indexOf(connection);
            target.splice(i, 1);

            this.handleEnd(connection);
          }
        });
      });
      server.listen(port, () => {
        resolve();
        console.log("server is listening:" + port);
      });
    });
  }
}

new ProxyServer();

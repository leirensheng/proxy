let BaseSend = require("./baseSend");
let { sleep, getTime } = require("../damai/utils");
const { curly } = require("node-libcurl");
const { spawn } = require("child_process");
const fetch = require("node-fetch");
const https = require("https");
function getUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    return (c === "x" ? (Math.random() * 16) | 0 : "r&0x3" | "0x8").toString(
      16,
    );
  });
}

class Client extends BaseSend {
  constructor({ showId, sessionId, seatPlanId, index }) {
    super();
    this.index = index;
    this.platform = "bili";
    this.valueType = "json";
    this.showId = showId;
    this.sessionId = sessionId;
    this.isNeedProxy = true;
    this.seatPlanId = seatPlanId;
    this.send = this.sendByFetch;
  }

  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent();
  }

  async initAgent() {
    this.uniqueId = getUUID();
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    this.isReady = true;
  }
  async sendByCurl(options) {
    if (!this.isReady) {
      return "";
    }
    const url = options.url;
    //有2种请求
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

    // 构造 httpHeader 数组（curly 要求）
    const httpHeader = Object.entries(headers).map(
      ([key, value]) => `${key}: ${value}`,
    );

    let resData = null;

    let errMsg;
    try {
      // 设置请求配置
      const curlOptions = {
        httpHeader,
        sslVerifyPeer: false, // 👈 关键：跳过证书验证
        sslVerifyHost: false, // 👈 同时跳过主机名验证
        timeout: 0.5, // 1秒超时（毫秒）
        // connectTimeout: 800,
        proxy: this.ip,
      };

      // // 设置方法和 body
      if (method === "POST") {
        curlOptions.post = true;
        if (body) curlOptions.postFields = body;
      }

      // 发起请求（带 1 秒超时）
      let res = await curly(url, curlOptions);
      let { statusCode, data } = res;
      if (statusCode === 200) {
        // console.log("ok");
        resData = data;
      } else {
        throw new Error(`请求失败，状态码: ${statusCode}`);
      }
    } catch (e) {
      errMsg = e.message;
      // 捕获 curly 抛出的错误（如网络错误、超时等）
      if (
        !e.message.match(
          /fetch\sfailed|403|timeout|Timeout|CURLE_OPERATION_TIMEDOUT| "<!DOCTYPE "... is not valid JSON|Unexpected|Failure when receiving data from the peer|Couldn't connect to server/,
        )
      ) {
        console.log("出错信息" + getTime(), e, url);
      }
      resData = null;
    }

    // 超时或无响应
    if (!resData) {
      return {
        errMsg,
        res: [],
      };
    }

    const { data, comments } = resData;

    // 处理 token invalid
    if (comments && comments.includes("invalid")) {
      console.log(
        url,
        "不应该出现的, token过期后更新===============>",
        getTime(),
      );
      await sleep(100000);
      // this.isReady = false;
      // await this.initAgent(true);
      // return this.sendByCurl(options);
    }

    // 成功逻辑
    if (comments && comments.includes("成功")) {
      const isApp = url.includes("644898358795db000137473f");
      let arr = [];

      if (isApp) {
        arr = (data || [])
          .map((one) => ({
            zoneConcreteId: one.zoneConcreteId,
            saleStatus: one.seatPlanSeatBits?.[0]?.bitstr,
          }))
          .filter((one) => one.saleStatus);
      } else {
        arr = (data || []).filter((one) => one.saleStatus);
      }

      return {
        res: arr,
        errMsg: "",
      };
    } else if (typeof resData === "string" && resData.includes("验证")) {
      return {
        errMsg: "滑块",
        res: [],
      };
    } else {
      console.log("未知错误", resData);
      return {
        errMsg: "未知错误" + (comments || ""),
        res: [],
      };
    }
  }

  async sendByFetch(options) {
    if (!this.isReady) {
      return "";
    }

    const url = options.url;
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

    let resData = null;
    let errMsg = null;

    try {
      // 解析 URL

      // 构造 fetch 配置
      const fetchOptions = {
        method: method,
        headers: headers,
        // 跳过 SSL 证书验证
        agent: new https.Agent({
          rejectUnauthorized: false,
          // 确保主机名验证也被跳过
          checkServerIdentity: () => undefined,
        }),
      };

      // 如果有请求体
      if (body && method === "POST") {
        fetchOptions.body = body;
        // 确保 Content-Type 正确
        if (!headers["Content-Type"] && typeof options.body === "object") {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            "Content-Type": "application/json",
          };
        }
      }

      // 设置代理（如果存在）- 使用更兼容的方式
      if (this.ip && this.ip.trim()) {
        try {
          const { HttpsProxyAgent } = require("https-proxy-agent");

          // 确保代理 URL 格式正确
          let proxyUrl = this.ip;
          if (
            !proxyUrl.startsWith("http://") &&
            !proxyUrl.startsWith("https://")
          ) {
            proxyUrl = "http://" + proxyUrl;
          }

          // console.log('使用代理:', proxyUrl);
          fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
        } catch (proxyError) {
          console.log("代理设置失败:", proxyError.message);
          // 继续使用无代理
        }
      }

      // 设置超时（500毫秒）
      let timeoutId;
      if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          controller.abort();
        }, 500);
        fetchOptions.signal = controller.signal;
      } else {
        // 兼容旧版本 Node.js
        const { AbortController } = require("abort-controller");
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          controller.abort();
        }, 500);
        fetchOptions.signal = controller.signal;
      }

      // 发起请求
      // console.log('发起请求:', method, url);
      const response = await fetch(url, fetchOptions);

      // 清除超时定时器
      if (timeoutId) clearTimeout(timeoutId);

      const statusCode = response.status;

      if (statusCode === 200) {
        // 检查响应类型
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          resData = await response.json();
        } else {
          const text = await response.text();
          // 尝试解析 JSON，即使 content-type 不是 application/json
          try {
            resData = JSON.parse(text);
          } catch {
            resData = text;
          }
        }
      } else {
        // 获取错误信息
        let errorBody;
        try {
          errorBody = await response.text();
        } catch {
          errorBody = "";
        }
        throw new Error(
          `请求失败，状态码: ${statusCode}, 响应: ${errorBody.substring(0, 100)}`,
        );
      }
    } catch (e) {
      errMsg = e.message;

      // 处理 DNS 错误
      if (errMsg.includes("ENOTFOUND") || errMsg.includes("getaddrinfo")) {
        errMsg = "DNS解析失败: " + errMsg;
      }

      // 处理超时错误
      if (
        e.name === "AbortError" ||
        e.type === "aborted" ||
        errMsg.includes("timeout") ||
        errMsg.includes("Timeout")
      ) {
        errMsg = "timeout";
      }

      // 处理网络连接错误
      if (
        errMsg.includes("fetch failed") ||
        errMsg.includes("network") ||
        errMsg.includes("connection")
      ) {
        errMsg = "网络连接失败";
      }

      // 保持原有的错误过滤逻辑
      const shouldLog = !errMsg.match(
        /fetch\sfailed|403|timeout|Timeout|CURLE_OPERATION_TIMEDOUT| "<!DOCTYPE "... is not valid JSON|Unexpected|网络连接失败|DNS解析失败/,
      );

      if (shouldLog) {
        try {
          console.log(
            "出错信息" + (typeof getTime === "function" ? getTime() : ""),
            errMsg,
            url,
          );
        } catch {
          console.log("出错信息", errMsg, url);
        }
      }

      // 如果是 DNS 错误，可以尝试直接使用 IP 或其他处理
      if (errMsg.includes("DNS解析失败")) {
        console.log("DNS解析失败，检查代理配置或网络连接");
        console.log("当前代理:", this.ip || "无");
      }

      resData = null;
    }

    // 超时或无响应
    if (!resData) {
      return {
        errMsg: errMsg || "请求失败",
        res: [],
      };
    }

    // 处理 token invalid
    if (
      resData &&
      typeof resData === "object" &&
      resData.comments &&
      typeof resData.comments === "string" &&
      resData.comments.includes("invalid")
    ) {
      console.log(
        url,
        "不应该出现的, token过期后更新===============>",
        typeof getTime === "function" ? getTime() : "",
      );

      if (typeof sleep === "function") {
        await sleep(100000);
      }

      // this.isReady = false;
      // await this.initAgent(true);
      // return this.sendByFetch(options);
    }

    // 成功逻辑
    if (
      resData &&
      typeof resData === "object" &&
      resData.comments &&
      (typeof resData.comments === "string"
        ? resData.comments.includes("成功")
        : false)
    ) {
      const isApp = url.includes("644898358795db000137473f");
      let arr = [];

      if (isApp) {
        arr = (resData.data || [])
          .map((one) => ({
            zoneConcreteId: one.zoneConcreteId,
            saleStatus: one.seatPlanSeatBits?.[0]?.bitstr,
          }))
          .filter((one) => one.saleStatus);
      } else {
        arr = (resData.data || []).filter((one) => one.saleStatus);
      }

      return {
        res: arr,
        errMsg: "",
      };
    }
    // 处理滑块验证
    else if (typeof resData === "string" && resData.includes("验证")) {
      return {
        errMsg: "滑块",
        res: [],
      };
    }
    // 其他情况
    else {
      console.log(
        "未知错误",
        typeof resData === "object"
          ? JSON.stringify(resData).substring(0, 200)
          : String(resData).substring(0, 200),
      );
      return {
        errMsg: "未知错误" + (resData.comments || ""),
        res: [],
      };
    }
  }
  async sendByCurl2(options) {
    if (!this.isReady) {
      return "";
    }

    const url = options.url;
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

    // 构造 curl 命令
    const curlArgs = [
      "-X",
      method,
      url,
      "--insecure",
      "--compressed",
      "--silent",
      "--max-time",
      "1", // 1秒超时（curl的--max-time单位是秒）
    ];

    // 添加代理（如果存在）
    if (this.ip) {
      curlArgs.push("--proxy", this.ip);
    }

    // 添加请求头
    Object.entries(headers).forEach(([key, value]) => {
      curlArgs.push("-H", `${key}: ${value}`);
    });

    // 添加请求体（如果是POST且有body）
    if (method === "POST" && body) {
      curlArgs.push("--data-raw", body);
    }

    let resData = null;
    let errMsg;

    try {
      const result = await new Promise((resolve, reject) => {
        const curl = spawn("C:\\Windows\\System32\\curl.exe", curlArgs, {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        curl.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        curl.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        curl.on("close", (code) => {
          if (code !== 0) {
            // 检查是否是超时错误
            if (code === 28 || stderr.includes("timed out")) {
              return reject(new Error("timeout"));
            }
            return reject(new Error(`Curl error ${code}: ${stderr}`));
          }

          try {
            // 尝试解析JSON响应
            const data = JSON.parse(stdout);
            resolve({
              statusCode: 200,
              data,
            });
          } catch (e) {
            // 如果不是JSON，返回原始字符串
            resolve({
              statusCode: 403,
              data: stdout,
            });
          }
        });

        curl.on("error", (error) => {
          reject(new Error(`Curl spawn error: ${error.message}`));
        });
      });

      const { statusCode, data } = result;

      if (statusCode === 200) {
        resData = data;
      } else {
        throw new Error(`请求失败，状态码: ${statusCode}`);
      }
    } catch (e) {
      errMsg = e.message;
      // 捕获错误（如网络错误、超时等）
      if (
        !e.message.match(
          /fetch\sfailed|403|timeout|Timeout|CURLE_OPERATION_TIMEDOUT| "<!DOCTYPE "... is not valid JSON|Unexpected/,
        )
      ) {
        console.log("出错信息" + getTime(), e, url);
      }
      resData = null;
    }

    // 超时或无响应
    if (!resData) {
      return {
        errMsg,
        res: [],
      };
    }

    // 处理响应数据（保持原有逻辑）
    let { data, comments } = resData;

    console.count(comments);
    // 处理 token invalid
    if (comments && comments.includes("invalid")) {
      console.log(
        url,
        "不应该出现的, token过期后更新===============>",
        getTime(),
      );
      await sleep(100000);
      // this.isReady = false;
      // await this.initAgent(true);
      // return this.sendByCurl(options);
    }

    // 成功逻辑
    if (comments && comments.includes("成功")) {
      const isApp = url.includes("644898358795db000137473f");
      let arr = [];

      if (isApp) {
        arr = (data || [])
          .map((one) => ({
            zoneConcreteId: one.zoneConcreteId,
            saleStatus: one.seatPlanSeatBits?.[0]?.bitstr,
          }))
          .filter((one) => one.saleStatus);
      } else {
        arr = (data || []).filter((one) => one.saleStatus);
      }

      return {
        res: arr,
        errMsg: "",
      };
    } else if (typeof resData === "string" && resData.includes("验证")) {
      return {
        errMsg: "滑块",
        res: [],
      };
    } else {
      console.log("未知错误", resData);
      return {
        errMsg: "未知错误" + (comments || ""),
        res: [],
      };
    }
  }
}

module.exports = Client;

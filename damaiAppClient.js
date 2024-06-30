let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { cmd, sleep, sendAppMsg } = require("../damai/utils");

class Client extends BaseSend {
  constructor(activityId, index, skuIdToTypeMap) {
    super();
    this.index = index;
    this.platform = "damai";
    this.valueType = "json";
    this.activityId = activityId;
    this.skuIdToTypeMap = skuIdToTypeMap;
    this.isNeedProxy = false;
    this.cityId = "";
    this.cityName = "";
    this.fridaPort = "2284";
  }

  async getHeaders(isRefresh) {
    return new Promise((r) => {
      let data = "";
      cmd(
        `python ../damai/rpcCheckIsSellout.py ${this.fridaPort} ${this.activityId}`,
        (val) => {
          data += val;
          // console.log(data);
          if (data.includes("done")) {
            data = data.match(/\{(.*)\}/)[1];
            let arr = data.split(", ").map((one) => one.trim());
            // console.log(arr);
            let noNeedEncode = [];
            data = arr.reduce((prev, cur) => {
              let res = cur.match(/^(.*?)=(.*?)$/);

              prev[res[1]] = noNeedEncode.includes(res[1])
                ? res[2]
                : encodeURIComponent(res[2]);
              return prev;
            }, {});

            let {
              deviceId,
              activityId,
              skuId,
              netType,
              sid,
              wua,
              utdid,
              umt,
              sign,
              t,
              uid,
              ttid,
              appKey,
              pv,
              extdata,
            } = data;
            var randomNum = Math.round(Math.random() * 10000000000000);

            let headers = {
              "a-orange-q":
                "appKey=23781390&appVersion=6000190&clientAppIndexVersion=1120240508160203260&clientVersionIndexVersion=0",
              "cache-control": "no-cache",
              "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
              "f-refer": "",
              "user-agent":
                "MTOPSDK%2F3.2.9.7+%28Android%3B12%3Bsamsung%3BSM-G988N%29",
              "x-app-conf-v": "",
              "x-app-ver": "",
              "x-appkey": appKey,
              "x-bx-version": "6.6.231201.33656539",
              "x-c-traceid": `${utdid}${t}${randomNum}`,
              "x-devid": deviceId,
              "x-extdata": extdata,
              "x-features": "",
              "x-mini-wua": "",
              "x-nettype": netType,
              "x-nq": netType,
              "x-pv": pv,
              "x-sgext": "",
              "x-sid": sid,
              "x-sign": sign,
              "x-t": t,
              "x-ttid": ttid,
              "x-uid": uid,
              "x-umt": umt,
              "x-utdid": utdid,
            };

            Object.keys(headers).forEach((one) => {
              if (headers[one] === "") {
                headers[one] = data[one];
              }
            });
            r(headers);
          }
        }
      );
    });
  }

  async getOptions(isRefresh) {
    let headers = await this.getHeaders(isRefresh);
    let obj = { itemId: String(this.activityId), comboChannel: "1" };

    return {
      url:
        "https://acs.m.taobao.com/gw/mtop.damai.item.detail.getdetail/1.0/?data=" +
        encodeURIComponent(JSON.stringify(obj)),
      headers,
      body: null,
      method: "GET",
    };
  }
  async init() {
    await this.initAgent();
    this.updateOptions();
  }
  updateOptions() {
    setInterval(() => {
      this.initAgent();
    }, 60000 * (this.index + 1));
  }

  async initAgent(isRefresh) {
    let options = await this.getOptions(isRefresh);
    let uniqueId = this.activityId + "_" + this.index;
    this.uniqueId = uniqueId;
    this.options = options;
    console.log("更新options");
    this.isReady = true;
  }

  async send() {
    if (!this.isReady) {
      return "";
    }
    let res;
    try {
      let p1 = fetch(this.options.url, {
        ...this.options,
        keepalive: true,
      }).then((res) => res.json());
      let p2 = sleep(2000);
      res = await Promise.race([p1, p2]);
    } catch (e) {
      console.log(e);
    }

    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    let { data, ret } = res;

    if (ret && ret[0].includes("成功")) {
      let {
        detailViewComponentMap: {
          item: {
            item: { buyBtnText },
          },
        },
      } = JSON.parse(data.legacy);
      console.log(buyBtnText);

      let isSellout = !buyBtnText.includes("立即");
      let arr = Object.keys(this.skuIdToTypeMap).map((id) => ({
        type: this.skuIdToTypeMap[id],
        skuStatus: "1",
        skuId: id,
        quantitySellAble: isSellout ? 0 : 9,
      }));

      return {
        res: arr,
        errMsg: "",
      };
    } else {
      console.log(ret);
      sendAppMsg("err", "模拟器发送请求出错" + ret[0], {
        type: "error",
      });

      await sleep(3000);
      throw new Error("出错");
    }
  }
}

let init = async () => {
  let obj = new Client(778334220184, 0, {
    5344030092942: "2024-06-08 周六 19:00_380元（看台）",
    5344030092943: "2024-06-08 周六 19:00_580元（看台）",
    5344030092944: "2024-06-08 周六 19:00_780元（看台）",
    5344030092945: "2024-06-08 周六 19:00_980元（内场）",
    5344030092946: "2024-06-09 周日 19:00_380元（看台）",
    5344030092947: "2024-06-09 周日 19:00_580元（看台）",
    5344030092948: "2024-06-09 周日 19:00_780元（看台）",
    5344030092949: "2024-06-09 周日 19:00_980元（内场）",
  });

  await obj.init();

  for (let i = 0; i <= 10000; i++) {
    let res = await obj.send();
    console.log(res);
  }
};

// init();
module.exports = Client;

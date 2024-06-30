let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep } = require("../damai/utils");
let cityJson = require("../damai/city.json");
let pinyin = require("../damai/pinyin.js");

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
  }

  async getMobileCookieAndToken(isRefresh) {
    let { cookie, token } = await new Promise((resolve) => {
      this.eventBus.once("getMobileCookieAndTokenDone", ({ token, cookie }) =>
        resolve({ token, cookie })
      );
      this.client.write(
        JSON.stringify({
          isRefresh,
          activityId: this.activityId,
          getMobileCookieAndToken: true,
        })
      );
    });

    this.cookie = cookie;
    this.token = token;
  }

  async getOptions(isRefresh) {
    await this.getMobileCookieAndToken(isRefresh);

    let data = {
      args: JSON.stringify({
        comboConfigRule: "true",
        sortType: "10",
        latitude: "0",
        longitude: "0",
        // dateType:"0",
        currentCityId: this.cityId,
        groupId: "2394",
        comboCityId: "852",
        platform: "8",
        comboChannel: "2",
        optionParam: true ? '[{"service":"1"}]' : null,
        dmChannel: "damai@damaih5_h5",
      }),
      patternName: "category_solo",
      patternVersion: "4.0",
      dr: JSON.stringify([
        {
          targetSectionId: "66c10b69-ad43-4aee-bd03-9a9bae3b5774",
          targetLayerId: "0c5f1463-3e0b-43c5-ae8c-dd76e49264f3",
        },
      ]),
      platform: "8",
      comboChannel: "2",
      dmChannel: "damai@damaih5_h5",
    };
    let t = Date.now();
    let sign = getSign(data, t, this.token);

    return {
      url: `https://mtop.damai.cn/h5/mtop.damai.mec.aristotle.get/3.0/?jsv=2.7.2&appKey=12574478&t=${t}&sign=${sign}&api=mtop.damai.mec.aristotle.get&v=3.0&H5Request=true&type=json&timeout=10000&dataType=json&valueType=string&forceAntiCreep=true&AntiCreep=true&useH5=true&data=${encodeURIComponent(
        JSON.stringify(data)
      )}`,
      headers: {
        accept: "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/x-www-form-urlencoded",
        priority: "u=1, i",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        cookie: this.cookie,
        Referer: "https://m.damai.cn/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    };
  }
  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.getCityCode();
    await this.initAgent();
    this.updateOptions();
  }
  updateOptions() {
    setInterval(() => {
      this.initAgent(true);
    }, 60000 * (this.index + 1));
  }

  async getCityCode() {
    let res = await fetch(
      "https://detail.damai.cn/item.htm?id=" + this.activityId,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
      }
    );
    res = await res.text();

    let city = res.match(/ <title>【(.*?)】/)[1];
    console.log(111, city);
    this.cityName = city;

    let cityCode = pinyin.getCamelChars(this.cityName)[0].toLowerCase();
    let cityId = cityJson
      .find((one) => one.prefix === cityCode)
      .cities.find((one) => one.name === this.cityName).damaiId;
    console.log("城市id", cityId);
    this.cityId = cityId;
  }

  async initAgent(isRefresh) {
    let options = await this.getOptions(isRefresh);
    let uniqueId = this.activityId + "_" + this.index;
    this.uniqueId = uniqueId;

    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    this.isReady = true;
  }

  async send() {
    if (!this.isReady) {
      return "";
    }
    let res;
    if (this.isNeedProxy) {
      res = await this.myProxy();
    } else {
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
    }

    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    let {
      data: { nodes },
    } = res;

    let activities = nodes[0].nodes[0].nodes;

    let hitTarget = activities.find(
      (one) => Number(one.data.id) === Number(this.activityId)
    );

    // console.log(hitTarget);
    let isSellout = !hitTarget;
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
  }
}

// let init = async () => {
//   let obj = new Client(
//     786356191740,
//     0,
//     {
//       5344030092942: "2024-06-08 周六 19:00_380元（看台）",
//       5344030092943: "2024-06-08 周六 19:00_580元（看台）",
//       5344030092944: "2024-06-08 周六 19:00_780元（看台）",
//       5344030092945: "2024-06-08 周六 19:00_980元（内场）",
//       5344030092946: "2024-06-09 周日 19:00_380元（看台）",
//       5344030092947: "2024-06-09 周日 19:00_580元（看台）",
//       5344030092948: "2024-06-09 周日 19:00_780元（看台）",
//       5344030092949: "2024-06-09 周日 19:00_980元（内场）",
//     },
//   );

//   await obj.init();

//   let res = await obj.send();
//   console.log("完成");

//   console.log(res);
// };

// init();
module.exports = Client;

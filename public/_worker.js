/**
 * =========================================================
 * 双源融合版 Cloudflare Worker
 * - SinParty T4 + M3U
 * - HC 聚合 T4 + M3U
 * =========================================================
 *
 * TVBox:
 * {
 *   "key": "merged_live",
 *   "name": "双源直播",
 *   "type": 4,
 *   "api": "https://你的Worker域名.workers.dev/",
 *   "filterable": 1
 * }
 *
 * M3U:
 * https://你的Worker域名.workers.dev/live.m3u
 * =========================================================
 */

const CONFIG_MODE = "filter"; // "filter" 或 "flat"

const SP_HOST = "https://sinparty.com";
const SP_API_HOST = "https://api.sinparty.com";

const HC_HOST = "http://api.hclyz.com:81/mf";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SP_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Referer": SP_HOST + "/",
    "Origin": SP_HOST
};

const HC_HEADERS = {
    "User-Agent": UA
};

const LIVE_PIC = "https://raw.githubusercontent.com/fish2018/lib/refs/heads/main/imgs/live.png";

const SP_NATIVE_CATEGORIES = [
    { "type_id": "sp_all", "type_name": "✨ SP精选" },
    { "type_id": "sp_girls", "type_name": "👩 SP女生" },
    { "type_id": "sp_guys", "type_name": "👨 SP男生" },
    { "type_id": "sp_couples", "type_name": "👩‍❤️‍👨 SP情侣" },
    { "type_id": "sp_trans", "type_name": "🏳️‍⚧️ SP变性人" }
];

const SP_NATIVE_FILTERS = {
    "sp_all": [{
        "key": "cat",
        "name": "排序",
        "value": [
            { "n": "全部", "v": "" },
            { "n": "热门推荐", "v": "trending" },
            { "n": "近期新人", "v": "new" },
            { "n": "私人节目", "v": "status_private" }
        ]
    }],
    "sp_girls": [{
        "key": "cat",
        "name": "标签",
        "value": [
            { "n": "全部", "v": "" },
            { "n": "亚洲", "v": "asian" },
            { "n": "成熟", "v": "mature" },
            { "n": "大胸", "v": "big_boobs" },
            { "n": "视角", "v": "pov" }
        ]
    }],
    "sp_guys": [{
        "key": "cat",
        "name": "标签",
        "value": [
            { "n": "全部", "v": "" },
            { "n": "肌肉", "v": "muscular" },
            { "n": "亚洲男", "v": "asian" },
            { "n": "熊系", "v": "bear" },
            { "n": "少年", "v": "twink" }
        ]
    }],
    "sp_trans": [{
        "key": "cat",
        "name": "标签",
        "value": [
            { "n": "全部", "v": "" },
            { "n": "成熟", "v": "mature" },
            { "n": "青少年", "v": "teen" }
        ]
    }]
};

const SP_FLATTENED_CATEGORIES = [
    { "type_id": "sp_all", "type_name": "✨ SP精选推荐" },
    { "type_id": "sp_all_trending", "type_name": "🔥 SP精选-热门" },
    { "type_id": "sp_all_new", "type_name": "🌱 SP精选-新人" },
    { "type_id": "sp_all_status_private", "type_name": "🔒 SP精选-私播" },
    { "type_id": "sp_girls", "type_name": "👩 SP女生全部" },
    { "type_id": "sp_girls_asian", "type_name": "🌏 SP女生-亚洲" },
    { "type_id": "sp_girls_mature", "type_name": "💃 SP女生-成熟" },
    { "type_id": "sp_girls_big_boobs", "type_name": "🍒 SP女生-大胸" },
    { "type_id": "sp_girls_pov", "type_name": "👁️ SP女生-视角" },
    { "type_id": "sp_guys", "type_name": "👨 SP男生全部" },
    { "type_id": "sp_guys_muscular", "type_name": "💪 SP男生-肌肉" },
    { "type_id": "sp_guys_asian", "type_name": "👲 SP男生-亚洲" },
    { "type_id": "sp_guys_bear", "type_name": "🐻 SP男生-熊系" },
    { "type_id": "sp_guys_twink", "type_name": "🧑 SP男生-少年" },
    { "type_id": "sp_couples", "type_name": "👩‍❤️‍👨 SP情侣连播" },
    { "type_id": "sp_trans", "type_name": "🏳️‍⚧️ SP变性全部" },
    { "type_id": "sp_trans_mature", "type_name": "👵 SP变性-成熟" },
    { "type_id": "sp_trans_teen", "type_name": "👧 SP变性-青少" }
];

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const params = url.searchParams;

        const m3uHeaders = {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
        };

        const corsHeaders = {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const action = params.get("ac") || path.slice(1);
            const tid = params.get("tid") || params.get("t") || "";
            const pg = params.get("pg") || params.get("page") || "1";
            const wd = params.get("wd") || params.get("key") || "";

            if (action === "live.m3u" || action === "m3u" || path.endsWith(".m3u")) {
                return new Response(await handleMergedM3U(url.origin), { headers: m3uHeaders });
            }

            if (action === "proxy_play") {
                return await handleProxyPlay(params);
            }

            if (action === "search" || wd) {
                return new Response(JSON.stringify({ "list": [] }), { headers: corsHeaders });
            }

            if (action === "detail" || params.get("ids")) {
                const ids = params.get("ids") || "";
                return new Response(JSON.stringify(await handleDetail(ids)), { headers: corsHeaders });
            }

            if (action === "play") {
                const id = params.get("id") || "";
                return new Response(JSON.stringify(handlePlay(id)), { headers: corsHeaders });
            }

            if (tid) {
                return new Response(JSON.stringify(await handleCategory(tid, pg, params)), { headers: corsHeaders });
            }

            return new Response(JSON.stringify(await handleHome()), { headers: corsHeaders });
        } catch (err) {
            return new Response(JSON.stringify({
                "list": [],
                "msg": err && err.message ? err.message : String(err)
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};

async function handleHome() {
    const spClasses = CONFIG_MODE === "flat"
        ? SP_FLATTENED_CATEGORIES
        : SP_NATIVE_CATEGORIES;

    let hcClasses = [];

    try {
        const res = await fetchWithTimeout(`${HC_HOST}/json.txt`, {
            headers: HC_HEADERS
        }, 6000);

        const json = await res.json();
        const platforms = json.pingtai || [];

        hcClasses = platforms.slice(1).map(item => ({
            "type_id": `hc_${item.address}`,
            "type_name": `📺 ${item.title || "直播平台"}`
        }));
    } catch (e) {
        hcClasses = [{
            "type_id": "hc_json.txt",
            "type_name": "⚠️ HC列表加载失败"
        }];
    }

    const result = {
        "class": [
            ...spClasses,
            ...hcClasses
        ]
    };

    if (CONFIG_MODE !== "flat") {
        result.filters = SP_NATIVE_FILTERS;
    }

    try {
        const defaultData = await fetchSinPartyItems("all", "1", "");
        result.list = defaultData.list || [];
    } catch (e) {
        result.list = [];
    }

    return result;
}

async function handleCategory(tid, pg, params) {
    if (tid.startsWith("sp_")) {
        return await handleSinPartyCategory(tid.slice(3), pg, params);
    }

    if (tid.startsWith("hc_")) {
        return await handleHcCategory(tid.slice(3));
    }

    return {
        "page": 1,
        "pagecount": 1,
        "limit": 0,
        "total": 0,
        "list": []
    };
}

async function handleSinPartyCategory(tid, pg, params) {
    const pageNum = parseInt(pg || "1");

    const result = {
        "list": [],
        "page": isNaN(pageNum) ? 1 : pageNum,
        "pagecount": 1,
        "limit": 40,
        "total": 0
    };

    try {
        const filterCat = getFilterCat(params);
        const resData = await fetchSinPartyItems(tid, pg, filterCat);

        result.list = resData.list || [];
        result.total = resData.total || result.list.length;
        result.pagecount = result.total > 0 ? Math.ceil(result.total / 40) : 1;
    } catch (e) {}

    return result;
}

async function handleHcCategory(address) {
    try {
        const res = await fetchWithTimeout(`${HC_HOST}/${address}`, {
            headers: HC_HEADERS
        }, 6000);

        const json = await res.json();
        const anchors = json.zhubo || [];

        const videos = anchors
            .filter(vod => vod && vod.address)
            .map(vod => ({
                "vod_id": encodePayload({
                    source: "hc",
                    title: vod.title || "直播间",
                    address: vod.address
                }),
                "vod_name": vod.title || "直播间",
                "vod_pic": LIVE_PIC,
                "vod_remarks": "📡 在线直播中"
            }));

        return {
            "page": 1,
            "pagecount": 1,
            "limit": videos.length,
            "total": videos.length,
            "list": videos
        };
    } catch (e) {
        return {
            "page": 1,
            "pagecount": 1,
            "limit": 0,
            "total": 0,
            "list": []
        };
    }
}

async function handleDetail(ids) {
    if (!ids) return { "list": [] };

    try {
        const payload = decodePayload(ids);

        if (payload.source === "hc") {
            return {
                "list": [{
                    "vod_id": ids,
                    "vod_name": payload.title || "直播间",
                    "vod_pic": "",
                    "vod_remarks": "📡 LIVE",
                    "vod_content": `当前主播：${payload.title || "直播间"}`,
                    "vod_play_from": "原画",
                    "vod_play_url": `原生原画高清流$${payload.address}`
                }]
            };
        }

        if (payload.source === "sp") {
            const streamUrl = await requestSinPartyStreamUrl(payload.vid);

            return {
                "list": [{
                    "vod_id": ids,
                    "vod_name": payload.title || "大秀直播间",
                    "vod_pic": payload.pic || "",
                    "vod_remarks": "📡 LIVE",
                    "vod_content": "直播流自动解析，主播下播时可能无法播放。",
                    "vod_play_from": "原画",
                    "vod_play_url": streamUrl
                        ? `超级原画极速流$${streamUrl}`
                        : "主播下播或换切流$http://0.0.0.0/off.m3u8"
                }]
            };
        }
    } catch (e) {}

    return { "list": [] };
}

function handlePlay(id) {
    return {
        "parse": 0,
        "url": id,
        "header": {
            "User-Agent": UA
        }
    };
}

async function handleProxyPlay(params) {
    const ids = params.get("ids") || "";
    const vid = params.get("vid") || "";

    try {
        let spVid = vid;

        if (!spVid && ids) {
            const payload = decodePayload(ids);
            if (payload.source === "sp") {
                spVid = payload.vid;
            }
        }

        if (!spVid) {
            return new Response("Missing VID", { status: 400 });
        }

        const streamUrl = await requestSinPartyStreamUrl(spVid);

        return streamUrl
            ? Response.redirect(streamUrl, 302)
            : new Response("Offline", { status: 404 });
    } catch (e) {
        return new Response("Proxy Error", { status: 500 });
    }
}

async function handleMergedM3U(workerOrigin) {
    let m3uResult = "#EXTM3U x-tvg-url=\"\"\n";

    const results = await Promise.allSettled([
        buildSinPartyM3U(workerOrigin),
        buildHcM3U()
    ]);

    if (results[0].status === "fulfilled") {
        m3uResult += results[0].value;
    }

    if (results[1].status === "fulfilled") {
        m3uResult += results[1].value;
    }

    if (m3uResult === "#EXTM3U x-tvg-url=\"\"\n") {
        m3uResult += `#EXTINF:-1 group-title="错误提示",未捕获到任何在线直播源\nhttp://0.0.0.0\n`;
    }

    return m3uResult;
}

async function buildSinPartyM3U(workerOrigin) {
    let m3u = "";

    const groups = [
        { id: "all", groupName: "SP - 精选推荐" },
        { id: "girls", groupName: "SP - 女生直播" },
        { id: "guys", groupName: "SP - 男生帅哥" },
        { id: "couples", groupName: "SP - 情侣连播" },
        { id: "trans", groupName: "SP - 变性视角" }
    ];

    try {
        const results = await Promise.all(
            groups.map(group => fetchSinPartyItems(group.id, "1", ""))
        );

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const data = results[i] || {};
            const list = data.list || [];
            const seen = new Set();

            for (const room of list) {
                if (!room.vod_id || seen.has(room.vod_id)) continue;
                seen.add(room.vod_id);

                const payload = encodePayload({
                    source: "sp",
                    vid: room.raw_vid || room.vod_id,
                    title: room.vod_name,
                    pic: room.vod_pic
                });

                m3u += `#EXTINF:-1 tvg-logo="${safeM3U(room.vod_pic)}" group-title="${safeM3U(group.groupName)}",${safeM3U(room.vod_name)} ${safeM3U(room.vod_remarks)}\n`;
                m3u += `${workerOrigin}/?ac=proxy_play&ids=${encodeURIComponent(payload)}\n`;
            }
        }
    } catch (e) {
        m3u += `#EXTINF:-1 group-title="SP错误",SP聚合失败\nhttp://0.0.0.0\n`;
    }

    return m3u;
}

async function buildHcM3U() {
    let m3u = "";

    try {
        const res = await fetchWithTimeout(`${HC_HOST}/json.txt`, {
            headers: HC_HEADERS
        }, 6000);

        const json = await res.json();
        const platforms = (json.pingtai || []).slice(1);

        platforms.sort((a, b) => parseInt(b.Number || 0) - parseInt(a.Number || 0));

        const topPlatforms = platforms.slice(0, 24);

        const results = await Promise.all(topPlatforms.map(async platform => {
            try {
                const subRes = await fetchWithTimeout(`${HC_HOST}/${platform.address}`, {
                    headers: HC_HEADERS
                }, 4000);

                const subJson = await subRes.json();

                const platformLogo = String(platform.xinimg || "").replace(
                    "http://cdn.gcufbd.top/img/",
                    "https://slink.ltd/https://raw.githubusercontent.com/fish2018/lib/refs/heads/main/imgs/"
                );

                return {
                    platformTitle: platform.title || "HC直播",
                    platformLogo,
                    anchors: subJson.zhubo || []
                };
            } catch (e) {
                return null;
            }
        }));

        for (const item of results) {
            if (!item) continue;

            for (const vod of item.anchors) {
                if (!vod || !vod.address) continue;

                m3u += `#EXTINF:-1 tvg-logo="${safeM3U(item.platformLogo)}" group-title="HC - ${safeM3U(item.platformTitle)}",${safeM3U(vod.title || "直播间")}\n`;
                m3u += `${String(vod.address).trim()}\n`;
            }
        }
    } catch (e) {
        m3u += `#EXTINF:-1 group-title="HC错误",HC网络列表加载失败\nhttp://0.0.0.0\n`;
    }

    return m3u;
}

async function fetchSinPartyItems(tid, pg, extCat) {
    const apiUrl = `${SP_API_HOST}/v2/web/live-cams/web-rtc`;
    const qParams = new URLSearchParams({
        "page": String(pg || "1"),
        "per_page": "40",
        "od": "desc"
    });

    let mainTid = tid;
    let subVal = extCat || "";

    if (tid.indexOf("_") >= 0) {
        const parts = tid.split("_");
        mainTid = parts[0];
        subVal = parts.slice(1).join("_");
    }

    if (mainTid === "couples") {
        qParams.append("category[]", "couples");
    } else if (mainTid === "trans") {
        qParams.append("category[]", "trans");
    } else if (mainTid === "guys") {
        qParams.append("gender[]", "m");
    } else {
        qParams.append("gender[]", "f");
        qParams.append("so", "has_straight");
    }

    if (subVal) {
        if (subVal.startsWith("status_")) {
            qParams.append("status[]", subVal.replace("status_", ""));
        } else {
            qParams.append("trending[]", subVal);
        }
    }

    const res = await fetchWithTimeout(`${apiUrl}?${qParams.toString()}`, {
        method: "GET",
        headers: SP_HEADERS
    }, 7000);

    const root = await res.json();
    const data = root.data || {};
    const items = data.items || [];

    const list = [];

    for (const item of items) {
        let rawVid = "";
        let pic = "";
        let name = "";

        if (item.creator_user_hash) {
            rawVid = `native|${item.creator_user_hash}`;
            pic = item.thumbnail_url || String(item.poster_set_template || "").replace("{size}", "360");
            name = item.title;
        } else if (item.Nickname) {
            rawVid = `external|${item.Nickname}`;
            pic = item.Thumbnail || item.Snapshot;
            name = item.Nickname;
        } else {
            continue;
        }

        const payload = encodePayload({
            source: "sp",
            vid: rawVid,
            title: name || "Live Cam",
            pic: pic || ""
        });

        list.push({
            "vod_id": payload,
            "raw_vid": rawVid,
            "vod_name": name || "Live Cam",
            "vod_pic": pic || "",
            "vod_remarks": `🔥 HOT: ${item.viewers || 0}`
        });
    }

    return {
        "list": list,
        "total": data.total || 0
    };
}

async function requestSinPartyStreamUrl(vid) {
    const parts = String(vid || "").split("|");
    if (parts.length < 2) return null;

    const mode = parts[0];
    const key = parts[1];

    try {
        if (mode === "external") {
            const extApi = `https://manifest-server.naiadsystems.com/live/s:${key}.json?vdc=true`;
            const headers = {
                "User-Agent": UA,
                "Referer": "https://sinpartylive.com/",
                "sitedomain": "sinpartylive.com",
                "tenantid": "SM"
            };

            const res = await fetchWithTimeout(extApi, {
                method: "GET",
                headers
            }, 7000);

            if (res.status === 200) {
                const json = await res.json();
                const hls = json.formats && json.formats["mp4-hls"] ? json.formats["mp4-hls"] : {};
                const playUrl = hls.manifest || (
                    hls.encodings && hls.encodings.length
                        ? hls.encodings[hls.encodings.length - 1].location
                        : null
                );

                if (playUrl) return playUrl.replace(/&amp;/g, "&");
            }
        } else {
            const apiUrl = `${SP_API_HOST}/v2/web/live-cams/web-rtc/${key}`;

            const res = await fetchWithTimeout(apiUrl, {
                method: "GET",
                headers: SP_HEADERS
            }, 7000);

            if (res.status === 200) {
                const json = await res.json();
                return json.data && json.data.playback_url ? json.data.playback_url : null;
            }
        }
    } catch (e) {}

    return null;
}

function getFilterCat(params) {
    let filter = params.get("f") || params.get("ext") || params.get("filter") || "";
    if (!filter) return "";

    try {
        if (filter.indexOf("%") >= 0) filter = decodeURIComponent(filter);
    } catch (e) {}

    if (!filter.startsWith("{") && /^[a-zA-Z0-9+/=]+$/.test(filter)) {
        try {
            filter = atob(filter);
        } catch (e) {}
    }

    try {
        const obj = JSON.parse(filter);
        if (obj && obj.cat) return obj.cat;
    } catch (e) {
        const marker = '"cat"';
        const index = filter.indexOf(marker);
        if (index >= 0) {
            const after = filter.slice(index + marker.length);
            const firstQuote = after.indexOf('"');
            const secondQuote = firstQuote >= 0 ? after.indexOf('"', firstQuote + 1) : -1;
            if (firstQuote >= 0 && secondQuote > firstQuote) {
                return after.slice(firstQuote + 1, secondQuote);
            }
        }
    }

    return "";
}

function encodePayload(obj) {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
}

function decodePayload(value) {
    return JSON.parse(decodeURIComponent(atob(value)));
}

function safeM3U(value) {
    return String(value || "")
        .replace(/[\r\n"]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchWithTimeout(resource, options, timeout) {
    const finalOptions = options || {};
    const finalTimeout = timeout || 6000;

    return await fetch(resource, {
        ...finalOptions,
        signal: AbortSignal.timeout(finalTimeout)
    });
}
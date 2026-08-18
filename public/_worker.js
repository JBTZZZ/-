/**
 * =========================================================
 * 多源融合增强版 Cloudflare Worker
 * - SinParty T4 + M3U
 * - HC 聚合 T4 + M3U
 * - TT 抖音直播 M3U
 * - CB 国外直播 M3U (api4)
 * - CB2 国外直播 M3U (api2)
 * - CB5 全球直播 M3U (api5)
 * - CB 分类频道 M3U (按地区/体型/主题分类)
 * =========================================================
 *
 * 融合自: JBTZZZ/- 双源版 + 四源增强版
 * 增强: 新增 TT/CB/CB2/CB5 源，启用 CB 分类频道，按源类型分类
 *
 * TVBox:
 * {
 *   "key": "merged_live",
 *   "name": "多源直播",
 *   "type": 4,
 *   "api": "https://你的Worker域名.workers.dev/",
 *   "filterable": 1
 * }
 *
 * M3U:
 * https://你的Worker域名.workers.dev/live.m3u
 * =========================================================
 */

// ===================== 配置 =====================
const CONFIG_MODE = "filter"; // "filter" 或 "flat"

// ===================== 源地址 =====================
const SP_HOST = "https://sinparty.com";
const SP_API_HOST = "https://api.sinparty.com";
const HC_HOST = "http://api.hclyz.com:81/mf";
const TT_HOST = "http://tiktok.xvideos4.tk/?otc=m3u";
const CB_HOST = "https://chaturbate.xvideos4.tk/api4.php?live.m3u";
const CB2_HOST = "https://chaturbate.xvideos4.tk/api2.php?otc=m3u";
const CB5_HOST = "https://chaturbate.xvideos4.tk/api5.php?m3u&all";
const CB_CAT_BASE = "https://chaturbate.xvideos4.tk/?otc=";

// ===================== 通用常量 =====================
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LIVE_PIC = "https://raw.githubusercontent.com/fish2018/lib/refs/heads/main/imgs/live.png";

const SP_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Referer": SP_HOST + "/",
    "Origin": SP_HOST
};
const HC_HEADERS = { "User-Agent": UA };

// ===================== SP 分类定义 =====================
const SP_NATIVE_CATEGORIES = [
    { "type_id": "sp_all", "type_name": "✨ SP精选" },
    { "type_id": "sp_girls", "type_name": "👩 SP女生" },
    { "type_id": "sp_guys", "type_name": "👨 SP男生" },
    { "type_id": "sp_couples", "type_name": "👩‍❤️‍👨 SP情侣" },
    { "type_id": "sp_trans", "type_name": "🏳️‍⚧️ SP变性人" }
];

const SP_NATIVE_FILTERS = {
    "sp_all": [{ "key": "cat", "name": "排序", "value": [
        { "n": "全部", "v": "" }, { "n": "热门推荐", "v": "trending" },
        { "n": "近期新人", "v": "new" }, { "n": "私人节目", "v": "status_private" }
    ]}],
    "sp_girls": [{ "key": "cat", "name": "标签", "value": [
        { "n": "全部", "v": "" }, { "n": "亚洲", "v": "asian" },
        { "n": "成熟", "v": "mature" }, { "n": "大胸", "v": "big_boobs" }, { "n": "视角", "v": "pov" }
    ]}],
    "sp_guys": [{ "key": "cat", "name": "标签", "value": [
        { "n": "全部", "v": "" }, { "n": "肌肉", "v": "muscular" },
        { "n": "亚洲男", "v": "asian" }, { "n": "熊系", "v": "bear" }, { "n": "少年", "v": "twink" }
    ]}],
    "sp_trans": [{ "key": "cat", "name": "标签", "value": [
        { "n": "全部", "v": "" }, { "n": "成熟", "v": "mature" }, { "n": "青少年", "v": "teen" }
    ]}]
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

// ===================== CB 分类频道定义 =====================
const CB_CATEGORIES = [
    // 地区/种族
    { code: "russian",     name: "🇷🇺 俄罗斯" },
    { code: "asian",       name: "🌏 亚洲" },
    { code: "latina",      name: "💃 拉丁" },
    { code: "ebony",       name: "🖤 黑人" },
    { code: "japanese",    name: "🗾 日本" },
    // 年龄/体型
    { code: "teen",        name: "🧑 青少年" },
    { code: "mature",      name: "👩 成熟" },
    { code: "milf",        name: "👩‍👧 熟女" },
    { code: "blonde",      name: "💛 金发" },
    { code: "brunette",    name: "🤎 黑发" },
    { code: "redhead",     name: "🧡 红发" },
    { code: "busty",       name: "🍒 巨乳" },
    { code: "bigtits",     name: "🍈 大胸" },
    { code: "bigass",      name: "🍑 巨臀" },
    { code: "bigdick",     name: "🍆 巨根" },
    { code: "petite",      name: "🌸 娇小" },
    // 内容主题
    { code: "lesbian",     name: "👩‍❤️‍👩 女同" },
    { code: "gay",         name: "👨‍❤️‍👨 男同" },
    { code: "rough",       name: "⚡ 粗暴" },
    { code: "gangbang",    name: "👥 群交" },
    { code: "squirt",      name: "💦 喷水" },
    { code: "anal",        name: "🔞 肛交" },
    { code: "bdsm",        name: "⛓️ BDSM" },
    { code: "fetish",      name: "🔗 恋物癖" },
    { code: "lingerie",    name: "👙 情趣内衣" },
    { code: "dildo",       name: "🍆 假阳具" },
    { code: "masturbation",name: "✋ 自慰" },
    { code: "toys",        name: "🧸 玩具" },
    { code: "couple",      name: "👩‍❤️‍👨 情侣" },
    { code: "threesome",   name: "🔢 三人行" },
    { code: "group",       name: "👥 群交" },
    { code: "blowjob",     name: "👄 口交" },
    { code: "pov",         name: "👁️ 第一视角" },
    { code: "hardcore",    name: "🔥 硬核" },
    { code: "cuckold",     name: "🟢 绿帽" },
    { code: "interracial", name: "🌍 跨种族" },
    { code: "public",      name: "🏙️ 公共" },
    { code: "outdoor",     name: "🌳 户外" },
    { code: "pornstar",    name: "⭐ 色情明星" },
    { code: "livecams",    name: "📹 真人摄像头" },
    { code: "Compilation", name: "📀 合集" }
];

// ===================== 入口 =====================
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
            if (action === "proxy_play") return await handleProxyPlay(params);
            if (action === "search" || wd) return new Response(JSON.stringify({ "list": [] }), { headers: corsHeaders });
            if (action === "detail" || params.get("ids")) {
                return new Response(JSON.stringify(await handleDetail(params.get("ids") || "")), { headers: corsHeaders });
            }
            if (action === "play") {
                return new Response(JSON.stringify(handlePlay(params.get("id") || "")), { headers: corsHeaders });
            }
            if (tid) {
                return new Response(JSON.stringify(await handleCategory(tid, pg, params)), { headers: corsHeaders });
            }
            return new Response(JSON.stringify(await handleHome()), { headers: corsHeaders });
        } catch (err) {
            return new Response(JSON.stringify({ "list": [], "msg": err && err.message ? err.message : String(err) }), {
                status: 500, headers: corsHeaders
            });
        }
    }
};

// ===================== TVBox 首页/分类 =====================
async function handleHome() {
    const spClasses = CONFIG_MODE === "flat" ? SP_FLATTENED_CATEGORIES : SP_NATIVE_CATEGORIES;
    let hcClasses = [];
    try {
        const res = await fetchWithTimeout(`${HC_HOST}/json.txt`, { headers: HC_HEADERS }, 6000);
        const json = await res.json();
        hcClasses = (json.pingtai || []).slice(1).map(item => ({
            "type_id": `hc_${item.address}`,
            "type_name": `📺 ${item.title || "直播平台"}`
        }));
    } catch (e) {
        hcClasses = [{ "type_id": "hc_json.txt", "type_name": "⚠️ HC列表加载失败" }];
    }
    const result = { "class": [...spClasses, ...hcClasses] };
    if (CONFIG_MODE !== "flat") result.filters = SP_NATIVE_FILTERS;
    try { result.list = (await fetchSinPartyItems("all", "1", "")).list || []; } catch (e) { result.list = []; }
    return result;
}

async function handleCategory(tid, pg, params) {
    if (tid.startsWith("sp_")) return await handleSinPartyCategory(tid.slice(3), pg, params);
    if (tid.startsWith("hc_")) return await handleHcCategory(tid.slice(3));
    return { "page": 1, "pagecount": 1, "limit": 0, "total": 0, "list": [] };
}

async function handleSinPartyCategory(tid, pg, params) {
    const pageNum = parseInt(pg || "1");
    const result = { "list": [], "page": isNaN(pageNum) ? 1 : pageNum, "pagecount": 1, "limit": 40, "total": 0 };
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
        const res = await fetchWithTimeout(`${HC_HOST}/${address}`, { headers: HC_HEADERS }, 6000);
        const json = await res.json();
        const videos = (json.zhubo || [])
            .filter(vod => vod && vod.address)
            .map(vod => ({
                "vod_id": encodePayload({ source: "hc", title: vod.title || "直播间", address: vod.address }),
                "vod_name": vod.title || "直播间",
                "vod_pic": LIVE_PIC,
                "vod_remarks": "📡 在线直播中"
            }));
        return { "page": 1, "pagecount": 1, "limit": videos.length, "total": videos.length, "list": videos };
    } catch (e) { return { "page": 1, "pagecount": 1, "limit": 0, "total": 0, "list": [] }; }
}

// ===================== 详情/播放/代理 =====================
async function handleDetail(ids) {
    if (!ids) return { "list": [] };
    try {
        const payload = decodePayload(ids);
        if (payload.source === "hc") {
            return { "list": [{ "vod_id": ids, "vod_name": payload.title || "直播间", "vod_pic": "",
                "vod_remarks": "📡 LIVE", "vod_content": `当前主播：${payload.title || "直播间"}`,
                "vod_play_from": "原画", "vod_play_url": `原生原画高清流$${payload.address}` }] };
        }
        if (payload.source === "sp") {
            const streamUrl = await requestSinPartyStreamUrl(payload.vid);
            return { "list": [{ "vod_id": ids, "vod_name": payload.title || "大秀直播间", "vod_pic": payload.pic || "",
                "vod_remarks": "📡 LIVE", "vod_content": "直播流自动解析，主播下播时可能无法播放。",
                "vod_play_from": "原画", "vod_play_url": streamUrl ? `超级原画极速流$${streamUrl}` : "主播下播或换切流$http://0.0.0.0/off.m3u8" }] };
        }
    } catch (e) {}
    return { "list": [] };
}

function handlePlay(id) {
    return { "parse": 0, "url": id, "header": { "User-Agent": UA } };
}

async function handleProxyPlay(params) {
    const ids = params.get("ids") || "";
    const vid = params.get("vid") || "";
    try {
        let spVid = vid;
        if (!spVid && ids) {
            const payload = decodePayload(ids);
            if (payload.source === "sp") spVid = payload.vid;
        }
        if (!spVid) return new Response("Missing VID", { status: 400 });
        const streamUrl = await requestSinPartyStreamUrl(spVid);
        return streamUrl ? Response.redirect(streamUrl, 302) : new Response("Offline", { status: 404 });
    } catch (e) { return new Response("Proxy Error", { status: 500 }); }
}

// ===================== M3U 合并输出 =====================
async function handleMergedM3U(workerOrigin) {
    let m3uResult = "#EXTM3U x-tvg-url=\"\"\n";
    const results = await Promise.allSettled([
        buildSinPartyM3U(workerOrigin),   // [0] SP
        buildHcM3U(),                      // [1] HC
        buildTtM3U(),                      // [2] TT 抖音
        buildCbM3U(),                      // [3] CB api4
        buildCb2M3U(),                     // [4] CB2 api2
        buildCb5M3U(),                     // [5] CB5 api5
        buildCbCategoryM3U()               // [6] CB 分类频道
    ]);
    for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") m3uResult += results[i].value;
    }
    if (m3uResult === "#EXTM3U x-tvg-url=\"\"\n") {
        m3uResult += `#EXTINF:-1 group-title="错误提示",未捕获到任何在线直播源\nhttp://0.0.0.0\n`;
    }
    return m3uResult;
}

// ===================== 各源 M3U 构建 =====================

// ---- SP ----
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
        const results = await Promise.all(groups.map(g => fetchSinPartyItems(g.id, "1", "")));
        for (let i = 0; i < groups.length; i++) {
            const data = results[i] || {};
            const seen = new Set();
            for (const room of (data.list || [])) {
                if (!room.vod_id || seen.has(room.vod_id)) continue;
                seen.add(room.vod_id);
                const payload = encodePayload({ source: "sp", vid: room.raw_vid || room.vod_id, title: room.vod_name, pic: room.vod_pic });
                m3u += `#EXTINF:-1 tvg-logo="${safeM3U(room.vod_pic)}" group-title="${safeM3U(groups[i].groupName)}",${safeM3U(room.vod_name)} ${safeM3U(room.vod_remarks)}\n`;
                m3u += `${workerOrigin}/?ac=proxy_play&ids=${encodeURIComponent(payload)}\n`;
            }
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="SP错误",SP聚合失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- HC ----
async function buildHcM3U() {
    let m3u = "";
    try {
        const res = await fetchWithTimeout(`${HC_HOST}/json.txt`, { headers: HC_HEADERS }, 6000);
        const json = await res.json();
        const platforms = (json.pingtai || []).slice(1);
        platforms.sort((a, b) => parseInt(b.Number || 0) - parseInt(a.Number || 0));
        const topPlatforms = platforms.slice(0, 24);
        const results = await Promise.all(topPlatforms.map(async platform => {
            try {
                const subRes = await fetchWithTimeout(`${HC_HOST}/${platform.address}`, { headers: HC_HEADERS }, 4000);
                const subJson = await subRes.json();
                const platformLogo = String(platform.xinimg || "").replace(
                    "http://cdn.gcufbd.top/img/",
                    "https://slink.ltd/https://raw.githubusercontent.com/fish2018/lib/refs/heads/main/imgs/"
                );
                return { platformTitle: platform.title || "HC直播", platformLogo, anchors: subJson.zhubo || [] };
            } catch (e) { return null; }
        }));
        for (const item of results) {
            if (!item) continue;
            for (const vod of item.anchors) {
                if (!vod || !vod.address) continue;
                m3u += `#EXTINF:-1 tvg-logo="${safeM3U(item.platformLogo)}" group-title="HC - ${safeM3U(item.platformTitle)}",${safeM3U(vod.title || "直播间")}\n`;
                m3u += `${String(vod.address).trim()}\n`;
            }
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="HC错误",HC网络列表加载失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- TT 抖音直播 ----
async function buildTtM3U() {
    let m3u = "";
    try {
        const res = await fetchWithTimeout(TT_HOST, { headers: { "User-Agent": UA } }, 10000);
        const text = await res.text();
        const lines = text.split("\n");
        let currentExtinf = "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#EXTINF:")) {
                currentExtinf = trimmed.replace(/group-title="[^"]*"/, 'group-title="TT - 抖音直播"');
            } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                if (currentExtinf) { m3u += currentExtinf + "\n"; currentExtinf = ""; }
                m3u += trimmed + "\n";
            }
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="TT错误",TT抖音源加载失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- CB 国外直播 (api4) ----
async function buildCbM3U() {
    let m3u = "";
    try {
        const res = await fetchWithTimeout(CB_HOST, { headers: { "User-Agent": UA } }, 10000);
        const text = await res.text();
        const lines = text.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#EXT-X-") || trimmed.startsWith("#PLAYLISTNAME")) continue;
            if (trimmed.startsWith("#EXTM3U")) continue;
            if (!trimmed) continue;
            m3u += trimmed + "\n";
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="CB错误",CB国外直播源(api4)加载失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- CB2 国外直播 (api2) ----
async function buildCb2M3U() {
    let m3u = "";
    try {
        const res = await fetchWithTimeout(CB2_HOST, { headers: { "User-Agent": UA } }, 10000);
        const text = await res.text();
        const lines = text.split("\n");
        for (const line of lines) {
            let trimmed = line.trim();
            if (trimmed.startsWith("#EXT-X-") || trimmed.startsWith("#PLAYLISTNAME")) continue;
            if (trimmed.startsWith("#EXTM3U")) continue;
            if (!trimmed) continue;
            if (trimmed.startsWith("#EXTINF:")) {
                trimmed = trimmed.replace(/group-title="([^"]*)"/, 'group-title="CB2-$1"');
            }
            m3u += trimmed + "\n";
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="CB2错误",CB2国外直播源(api2)加载失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- CB5 全球直播 (api5) ----
async function buildCb5M3U() {
    let m3u = "";
    try {
        const res = await fetchWithTimeout(CB5_HOST, { headers: { "User-Agent": UA } }, 10000);
        const text = await res.text();
        const lines = text.split("\n");
        for (const line of lines) {
            let trimmed = line.trim();
            if (trimmed.startsWith("#EXT-X-") || trimmed.startsWith("#PLAYLISTNAME")) continue;
            if (trimmed.startsWith("#EXTM3U")) continue;
            if (!trimmed) continue;
            if (trimmed.startsWith("#EXTINF:")) {
                trimmed = trimmed.replace(/group-title="([^"]*)"/, 'group-title="CB5-$1"');
            }
            m3u += trimmed + "\n";
        }
    } catch (e) { m3u += `#EXTINF:-1 group-title="CB5错误",CB5全球直播源(api5)加载失败\nhttp://0.0.0.0\n`; }
    return m3u;
}

// ---- CB 分类频道 ----
async function buildCbCategoryM3U() {
    let m3u = "";
    try {
        const results = await Promise.allSettled(CB_CATEGORIES.map(cat =>
            fetchWithTimeout(`${CB_CAT_BASE}${cat.code}.m3u8`, { headers: { "User-Agent": UA } }, 8000)
        ));
        for (let i = 0; i < CB_CATEGORIES.length; i++) {
            const cat = CB_CATEGORIES[i];
            const res = results[i];
            if (res.status !== "fulfilled" || !res.value || res.value.status !== 200) {
                m3u += `#EXTINF:-1 group-title="CB分类 - ${cat.name}",[${cat.name}] 分类暂时无直播\nhttp://0.0.0.0\n`;
                continue;
            }
            const text = await res.value.text();
            const lines = text.split("\n");
            let hasStream = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith("#EXTM3U") || trimmed.startsWith("#EXT-X-") || trimmed.startsWith("#PLAYLISTNAME")) continue;
                if (trimmed.startsWith("#EXTINF:")) {
                    const fixed = trimmed.replace(/group-title="[^"]*"/, `group-title="CB分类 - ${cat.name}"`);
                    m3u += fixed + "\n";
                } else {
                    m3u += trimmed + "\n";
                }
                hasStream = true;
            }
            if (!hasStream) {
                m3u += `#EXTINF:-1 group-title="CB分类 - ${cat.name}",[${cat.name}] 暂无直播流\nhttp://0.0.0.0\n`;
            }
        }
    } catch (e) {
        m3u += `#EXTINF:-1 group-title="CB分类错误",CB分类频道加载失败\nhttp://0.0.0.0\n`;
    }
    return m3u;
}

// ===================== 基础工具函数 =====================

// ---- SP API 数据获取 ----
async function fetchSinPartyItems(genderTid, page, filterCat) {
    const pageNum = Math.max(1, parseInt(page || "1"));
    const reqBody = new URLSearchParams();
    reqBody.set("page", String(pageNum));
    reqBody.set("per_page", "40");
    reqBody.set("od", "desc");

    const tid = String(genderTid || "all").toLowerCase();
    const isTrending = filterCat.includes("trending");
    const isNew = filterCat.includes("new");
    const isPrivate = filterCat.includes("status_private");
    const isTag = !isTrending && !isNew && !isPrivate && filterCat.length > 0;

    switch (tid) {
        case "girls":
            reqBody.set("gender[]", "f");
            if (isTrending) reqBody.set("trending[]", "1");
            else if (isNew) reqBody.set("status[]", "new");
            else if (isPrivate) reqBody.set("status[]", "private");
            else if (isTag) reqBody.set("tag[]", filterCat);
            break;
        case "guys":
            reqBody.set("gender[]", "m");
            if (isTrending) reqBody.set("trending[]", "1");
            else if (isNew) reqBody.set("status[]", "new");
            else if (isPrivate) reqBody.set("status[]", "private");
            else if (isTag) reqBody.set("tag[]", filterCat);
            break;
        case "couples":
            reqBody.set("category[]", "couples");
            if (isTrending) reqBody.set("trending[]", "1");
            else if (isNew) reqBody.set("status[]", "new");
            else if (isPrivate) reqBody.set("status[]", "private");
            break;
        case "trans":
            reqBody.set("category[]", "trans");
            if (isTrending) reqBody.set("trending[]", "1");
            else if (isNew) reqBody.set("status[]", "new");
            else if (isPrivate) reqBody.set("status[]", "private");
            else if (isTag) reqBody.set("tag[]", filterCat);
            break;
        default: // all
            if (isTrending) reqBody.set("trending[]", "1");
            else if (isNew) reqBody.set("status[]", "new");
            else if (isPrivate) reqBody.set("status[]", "private");
            break;
    }

    const res = await fetchWithTimeout(`${SP_API_HOST}/v2/web/live-cams/web-rtc`, {
        method: "POST",
        headers: { ...SP_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: reqBody.toString()
    }, 10000);
    const json = await res.json();
    const rooms = (json.data && json.data.rooms) || json.rooms || [];
    const total = json.total || json.data?.total || rooms.length;

    return {
        list: rooms.filter(r => r && r.id).map(r => {
            const vid = r.id;
            const title = r.display_name || r.username || r.id;
            const pic = r.avatar || r.avatar_url || r.thumb || "";
            const tags = (r.tags || []).join(" ");
            const viewers = r.viewers || r.num_users || 0;
            const age = r.age || "";
            const country = r.country || "";
            const remarks = `👁${viewers} ${age ? "🔞" + age : ""} ${country ? "🌍" + country : ""}`.trim();
            const payload = encodePayload({ source: "sp", vid, title, pic });
            return {
                "vod_id": payload,
                "vod_name": title,
                "vod_pic": pic,
                "vod_remarks": remarks,
                "raw_vid": vid,
                "vod_tag": tags
            };
        }),
        total
    };
}

// ---- SP 流地址解析 ----
async function requestSinPartyStreamUrl(vid) {
    if (!vid) return null;
    try {
        const externalRes = await fetchWithTimeout(
            `https://manifest-server.naiadsystems.com/live/s:${vid}.json?vdc=true`,
            { headers: { "User-Agent": UA } }, 5000
        );
        if (externalRes.ok) {
            const extJson = await externalRes.json();
            const manifestUrl = extJson?.manifest?.hls || extJson?.manifest?.["hls-fmp4"] || extJson?.url || extJson?.manifest_url;
            if (manifestUrl) return manifestUrl;
        }
    } catch (e) {}

    try {
        const nativeRes = await fetchWithTimeout(
            `${SP_API_HOST}/v2/web/live-cams/web-rtc/${vid}`,
            { headers: SP_HEADERS }, 5000
        );
        if (nativeRes.ok) {
            const nativeJson = await nativeRes.json();
            const playbackUrl = nativeJson?.playback_url || nativeJson?.data?.playback_url || nativeJson?.url;
            if (playbackUrl) return playbackUrl;
        }
    } catch (e) {}
    return null;
}

// ---- 过滤参数解析 ----
function getFilterCat(params) {
    if (!params) return "";
    const cat = params.get("cat") || "";
    const filterVal = params.get("filter") || "";
    const filterCat = params.get("filterCat") || "";
    return cat || filterVal || filterCat || "";
}

// ---- Payload 编解码 ----
function encodePayload(obj) {
    try {
        return btoa(encodeURIComponent(JSON.stringify(obj)));
    } catch (e) {
        return btoa(JSON.stringify(obj));
    }
}

function decodePayload(str) {
    try {
        return JSON.parse(decodeURIComponent(atob(str)));
    } catch (e) {
        try { return JSON.parse(atob(str)); } catch (e2) { return {}; }
    }
}

// ---- M3U 安全文本清理 ----
function safeM3U(str) {
    if (!str) return "";
    return String(str).replace(/[\r\n]+/g, " ").replace(/,/g, "，").trim();
}

// ---- 带超时 fetch ----
async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10000);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timeout);
    }
}

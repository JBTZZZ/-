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

            if (action === "search"

// Cloudflare Worker: Milas Belediyesi KEOS e-imar sistemine HTTPS proxy.
//
// Neden gerekli: keos.milas.bel.tr sadece http destekliyor (https sertifikası yok).
// GitHub Pages gibi https sitelerden tarayıcı bu http adrese doğrudan istek
// göndermeyi "mixed content" olarak engelliyor. Bu worker, isteği sunucu
// tarafında (tarayıcı kısıtlaması olmadan) http üzerinden yapıp sonucu
// https + CORS başlıklarıyla geri döndürür.
//
// Kurulum: Cloudflare hesabınızda Workers & Pages > Create Worker'a bu kodu
// yapıştırıp Deploy edin. Size verilen *.workers.dev adresini
// src/ArsaPaylastir.js içindeki MILAS_PROXY_BASE sabitine yazın.

const UPSTREAM = "http://keos.milas.bel.tr/imardurumu";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    let upstreamPath;
    if (url.pathname === "/imar") {
      const parselid = url.searchParams.get("parselid") || "";
      upstreamPath = `/imar.aspx?parselid=${encodeURIComponent(parselid)}`;
    } else if (url.pathname === "/kml") {
      const token = url.searchParams.get("token") || "";
      upstreamPath = `/service/kml.ashx?token=${encodeURIComponent(token)}`;
    } else {
      return new Response("Not found. Use /imar?parselid=X or /kml?token=X", {
        status: 404,
        headers: corsHeaders(),
      });
    }

    const upstreamRes = await fetch(UPSTREAM + upstreamPath, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const body = await upstreamRes.arrayBuffer();
    const headers = corsHeaders();
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    return new Response(body, { status: upstreamRes.status, headers });
  },
};

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
}

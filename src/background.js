
const filters = {
    urls: [
        "http://*/*",
        "https://*/*",
    ],
};


function parseUrlParams(url) {
    const parts = url.split("?");
    if(parts.length < 2) {
        return null;
    }
    return Object.fromEntries(new URLSearchParams(parts[1]));
}

function sniffForJSONRequestPayload(query) {
    // try checking the headers
    const contentTypeHeader = query.requestHeaders.find(h => h.name === "content-type");
    if(
        contentTypeHeader
        && contentTypeHeader.value.indexOf("application/json") != -1
    ) {
        return true;
    }

    // try Sniffing the body
    const hasJsonStructure = str => {
        // Thanks https://stackoverflow.com/questions/9804777/how-to-test-if-a-string-is-json-or-not
        if (typeof str !== 'string') return false;
        try {
            const result = JSON.parse(str);
            const type = Object.prototype.toString.call(result);
            return type === '[object Object]'
                || type === '[object Array]';
        } catch (err) {
            return false;
        }
    }
    let allHaveJSONStructure = true;
    for(let i=0; i<query.bodyParts.length; i++) {
        if(!hasJsonStructure(query.bodyParts[i])) {
            allHaveJSONStructure = false;
            break;
        }
    }
    if(allHaveJSONStructure) {
        return true;
    }

}

function supportsBody(method) {
    return [
        "post",
        "put",
        "patch",
    ].indexOf(method.toLowerCase()) != -1;
}

function hasRawBody(eventData) {
    return eventData.requestBody && eventData.requestBody.raw && eventData.requestBody.raw.length > 0;
}



async function enrichCompletedQuery(query) {

    // Parse url query params
    const queryParams = parseUrlParams(query.url);
    query.parsedQueryParams = queryParams !== null ? queryParams : null;

    // Parse request body
    if(query.bodyParts && query.bodyParts.length > 0) {
        query.parsedBodyParts = []
        if(sniffForJSONRequestPayload(query)) {
            for(let i=0; i<query.bodyParts.length; i++) {
                try {
                    query.parsedBodyParts.push(JSON.parse(query.bodyParts[i]));
                } catch (err) {
                    console.error(err);
                }
            }
        } else {
            console.warn("unknown content type");
            console.warn(query.requestHeaders.find(h => h.name === "content-type"))
            console.warn(query.bodyParts)
        }
    }

    // check for cross origin
    if (query.frameId > 0) {
        query.isCrossDomain = true;
    } else {
        query.host = (new URL(query.url)).host;
        const instigatorHost = (new URL(query.initiator)).host;
        query.isCrossDomain = Boolean(
            query.host !== (new URL(query.initiator)).host
            || (
                query.host.split(".").splice(query.host.split(".").length - 2)
                !== instigatorHost.split(".").splice(instigatorHost.split(".").length - 2)
            )
        );
    }

    console.log({[query.method]: query});
}

/*
    Storage keys:
        reqID : the chrome request id
*/

chrome.webRequest.onErrorOccurred.addListener(data => {
    const key = `req${data.requestId}`;
    chrome.storage.local.remove([key]);
}, filters, []);


chrome.webRequest.onSendHeaders.addListener(data => {
    const key = `req${data.requestId}`;
    chrome.storage.local.set({[key]: data});
}, filters, ["requestHeaders"]);


chrome.webRequest.onBeforeRequest.addListener(data => {
    const key = `req${data.requestId}`;
    const inner = (attempt) => {
        if(attempt > 10) {
            return console.warn("onBeforeRequest: could not find key " + key)
        }
        chrome.storage.local.get([key], (results) => {
            if(!results[key]) {
                setTimeout((v) => { inner(++attempt) }, 1)
                return;
            }
            const request = results[key];
            if(supportsBody(data.method) && hasRawBody(data)) {
                let parts = [];
                data.requestBody.raw.forEach(data => {
                    let bodyStr;
                    try {
                        bodyStr = new TextDecoder().decode(data.bytes);
                    } catch (err) {
                        console.warn("could not decode body")
                    }
                    if(bodyStr) {
                        parts.push(bodyStr)
                    }
                });
                request.bodyParts = parts;
                chrome.storage.local.set({[key]: request});
            }
        });
    };
    inner(0);
}, filters, ["requestBody"]);


chrome.webRequest.onCompleted.addListener(data => {
    const key = `req${data.requestId}`;
    const inner = (attempt) => {
        if(attempt > 10) {
            return console.warn("onCompleted: could not find key " + key)
        }
        chrome.storage.local.get([key], (results) => {
            if(!results[key]) {
                setTimeout((v) => { inner(++attempt) }, 1)
                return;
            }
            chrome.storage.local.remove([key]);
            enrichCompletedQuery({
                ...results[key],
                responseHeaders: data.responseHeaders,
            });
        });
    };
    inner(0)
}, filters, ["responseHeaders"]);

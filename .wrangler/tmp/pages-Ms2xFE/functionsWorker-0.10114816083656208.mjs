var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/@tidbcloud/serverless/dist/index.js
function format(query, values) {
  return Array.isArray(values) ? replacePosition(query, values) : replaceNamed(query, values);
}
__name(format, "format");
function replacePosition(query, values) {
  let index = 0;
  return query.replace(/\?/g, (match2) => {
    return index < values.length ? sanitize(values[index++]) : match2;
  });
}
__name(replacePosition, "replacePosition");
function replaceNamed(query, values) {
  return query.replace(/:(\w+)/g, (match2, name) => {
    return hasOwn(values, name) ? sanitize(values[name]) : match2;
  });
}
__name(replaceNamed, "replaceNamed");
function hasOwn(obj, name) {
  return Object.prototype.hasOwnProperty.call(obj, name);
}
__name(hasOwn, "hasOwn");
function sanitize(value) {
  if (value == null) {
    return "null";
  }
  if (["number", "bigint"].includes(typeof value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Uint8Array) {
    return uint8ArrayToHex(value);
  }
  if (typeof value === "string") {
    return quote(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitize).join(", ");
  }
  if (value instanceof Date) {
    return quote(value.toISOString().replace("Z", ""));
  }
  return quote(value.toString());
}
__name(sanitize, "sanitize");
function quote(text) {
  return `'${escape(text)}'`;
}
__name(quote, "quote");
var re = /[\0\b\n\r\t\x1a\\"']/g;
function escape(text) {
  return text.replace(re, replacement);
}
__name(escape, "escape");
function replacement(text) {
  switch (text) {
    case '"':
      return '\\"';
    case "'":
      return "\\'";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "	":
      return "\\t";
    case "\\":
      return "\\\\";
    case "\0":
      return "\\0";
    case "\b":
      return "\\b";
    case "":
      return "\\Z";
    default:
      return "";
  }
}
__name(replacement, "replacement");
function uint8ArrayToHex(uint8) {
  const digits = Array.from(uint8).map((i) => i.toString(16).padStart(2, "0"));
  return `0x${digits.join("")}`;
}
__name(uint8ArrayToHex, "uint8ArrayToHex");
function cast(field, value, decoder) {
  if (value === null) {
    return null;
  }
  if (decoder[field.type]) {
    return decoder[field.type](value);
  }
  switch (field.type) {
    // bool will be converted to TINYINT
    case "TINYINT":
    case "UNSIGNED TINYINT":
    case "SMALLINT":
    case "UNSIGNED SMALLINT":
    case "MEDIUMINT":
    case "UNSIGNED MEDIUMINT":
    case "INT":
    case "UNSIGNED INT":
    case "YEAR":
      return parseInt(value, 10);
    case "FLOAT":
    case "DOUBLE":
      return parseFloat(value);
    case "BIGINT":
    case "UNSIGNED BIGINT":
    case "DECIMAL":
    case "SET":
    case "ENUM":
    case "CHAR":
    case "VARCHAR":
    case "TEXT":
    case "MEDIUMTEXT":
    case "LONGTEXT":
    case "TINYTEXT":
    case "DATE":
    case "TIME":
    case "DATETIME":
    case "TIMESTAMP":
      return value;
    case "BLOB":
    case "TINYBLOB":
    case "MEDIUMBLOB":
    case "LONGBLOB":
    case "BINARY":
    case "VARBINARY":
    case "BIT":
      return hexToUint8Array(value);
    case "JSON":
      return JSON.parse(value);
    default:
      return value;
  }
}
__name(cast, "cast");
function hexToUint8Array(hexString) {
  const uint8Array = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    uint8Array[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return uint8Array;
}
__name(hexToUint8Array, "hexToUint8Array");
var DatabaseError = class extends Error {
  static {
    __name(this, "DatabaseError");
  }
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
};
var Version = "0.3.0";
async function postQuery(config, body, session = "", isolationLevel = null, debug, statefulAction) {
  let fetchCacheOption = { cache: "no-store" };
  try {
    new Request("x:", fetchCacheOption);
  } catch (err) {
    fetchCacheOption = {};
  }
  const requestId = generateUniqueId();
  if (debug) {
    console.log(`[serverless-js debug] request id: ${requestId}`);
  }
  const url = new URL("/v1beta/sql", `https://http-${config.host}`);
  const auth = btoa(`${config.username}:${config.password}`);
  const { fetch: fetch2 } = config;
  const database = config.database ?? "";
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": `serverless-js/${Version}`,
    Authorization: `Basic ${auth}`,
    "TiDB-Database": database,
    "TiDB-Session": session,
    "X-Debug-Trace-Id": requestId,
    "Accept-Encoding": "gzip"
  };
  if (isolationLevel) {
    headers["TiDB-Isolation-Level"] = isolationLevel;
  }
  if (statefulAction) {
    headers["TiDB-Stateful-Action"] = statefulAction;
  }
  const response = await fetch2(url.toString(), {
    method: "POST",
    body,
    headers,
    ...fetchCacheOption
  });
  if (debug) {
    const traceId = response?.headers?.get("X-Debug-Trace-Id");
    console.log(`[serverless-js debug] response id: ${traceId}`);
    const contentEncoding = response?.headers?.get("Content-Encoding");
    console.log(`[serverless-js debug] Content-Encoding: ${contentEncoding}`);
  }
  if (response.ok) {
    const resp = await response.json();
    const session2 = response.headers.get("TiDB-Session");
    resp.session = session2 ?? "";
    return resp;
  } else {
    let error;
    try {
      const e = await response.json();
      error = new DatabaseError(e.message, response.status, e);
    } catch {
      error = new DatabaseError(response.statusText, response.status, null);
    }
    throw error;
  }
}
__name(postQuery, "postQuery");
function generateUniqueId() {
  const datetime = (/* @__PURE__ */ new Date()).toISOString().replace(/[^\d]/g, "").slice(0, 14);
  return `${datetime}${randomString(20)}`;
}
__name(generateUniqueId, "generateUniqueId");
function randomString(n) {
  let result = "";
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const l = characters.length;
  for (let i = 0; i < n; i++) {
    result += characters[Math.floor(Math.random() * l)];
  }
  return result;
}
__name(randomString, "randomString");
var defaultExecuteOptions = {};
var Tx = class {
  static {
    __name(this, "Tx");
  }
  constructor(conn) {
    this.conn = conn;
  }
  async execute(query, args = null, options = defaultExecuteOptions) {
    return this.conn.execute(query, args, options);
  }
  async commit() {
    return this.conn.execute("COMMIT");
  }
  async rollback() {
    return this.conn.execute("ROLLBACK");
  }
};
var Connection = class _Connection {
  static {
    __name(this, "_Connection");
  }
  constructor(config) {
    var _a;
    this.session = null;
    this.config = { ...config };
    if (typeof fetch !== "undefined") {
      (_a = this.config).fetch || (_a.fetch = fetch);
    }
    if (config.url) {
      const url = new URL(config.url);
      if (!this.config.username) {
        this.config.username = decodeURIComponent(url.username);
      }
      if (!this.config.password) {
        this.config.password = decodeURIComponent(url.password);
      }
      if (!this.config.host) {
        this.config.host = url.hostname;
      }
      if (!this.config.database) {
        this.config.database = decodeURIComponent(url.pathname.slice(1));
      }
    }
  }
  getConfig() {
    return this.config;
  }
  async begin(txOptions = {}) {
    const conn = new _Connection(this.config);
    const tx = new Tx(conn);
    await conn.execute("BEGIN", void 0, void 0, txOptions);
    return tx;
  }
  async persist() {
    const conn = new _Connection(this.config);
    await conn.execute("", null, defaultExecuteOptions, {}, "open");
    const stateful = new StatefulConnection(conn);
    return stateful;
  }
  async execute(query, args = null, options = defaultExecuteOptions, txOptions = {}, statefulAction) {
    const sql = args ? format(query, args) : query;
    const body = JSON.stringify({ query: sql });
    const debug = options.debug ?? this.config.debug ?? false;
    if (debug) {
      console.log(`[serverless-js debug] sql: ${sql}`);
    }
    const resp = await postQuery(
      this.config,
      body,
      this.session ?? "",
      sql == "BEGIN" ? txOptions.isolation : null,
      debug,
      statefulAction
    );
    this.session = resp?.session ?? null;
    if (this.session === null || this.session === "") {
      throw new DatabaseError("empty session, please try again", 500, null);
    }
    const arrayMode = options.arrayMode ?? this.config.arrayMode ?? false;
    const fullResult = options.fullResult ?? this.config.fullResult ?? false;
    const decoders = { ...this.config.decoders, ...options.decoders };
    const fields = resp?.types ?? [];
    const rows = resp ? parse(fields, resp?.rows ?? [], cast, arrayMode, decoders) : [];
    if (fullResult) {
      const rowsAffected = resp?.rowsAffected ?? null;
      const lastInsertId = resp?.sLastInsertID ?? null;
      const typeByName = /* @__PURE__ */ __name((acc, { name, type }) => ({ ...acc, [name]: type }), "typeByName");
      const types = fields.reduce(typeByName, {});
      return {
        statement: sql,
        types,
        rows,
        rowsAffected,
        lastInsertId,
        rowCount: rows.length
      };
    }
    return rows;
  }
};
var StatefulConnection = class {
  static {
    __name(this, "StatefulConnection");
  }
  constructor(conn) {
    this.conn = conn;
  }
  async execute(query, args = null, options = defaultExecuteOptions) {
    return this.conn.execute(query, args, options);
  }
  async close() {
    await this.conn.execute("", null, defaultExecuteOptions, {}, "close");
  }
};
function connect(config) {
  return new Connection(config);
}
__name(connect, "connect");
function parseArrayRow(fields, rawRow, cast2, decoders) {
  return fields.map((field, ix) => {
    return cast2(field, rawRow[ix], decoders);
  });
}
__name(parseArrayRow, "parseArrayRow");
function parseObjectRow(fields, rawRow, cast2, decoders) {
  return fields.reduce((acc, field, ix) => {
    acc[field.name] = cast2(field, rawRow[ix], decoders);
    return acc;
  }, {});
}
__name(parseObjectRow, "parseObjectRow");
function parse(fields, rows, cast2, arrayMode, decode) {
  return rows.map((row) => arrayMode === true ? parseArrayRow(fields, row, cast2, decode) : parseObjectRow(fields, row, cast2, decode));
}
__name(parse, "parse");

// _lib.js
function buildUrl(env) {
  const host = env.DB_HOST || "127.0.0.1";
  const port = env.DB_PORT || "4000";
  const user = env.DB_USER || "root";
  const pass = env.DB_PASSWORD || "";
  const db = env.DB_NAME || "dictionary";
  return "mysql://" + encodeURIComponent(user) + ":" + encodeURIComponent(pass) + "@" + host + ":" + port + "/" + db;
}
__name(buildUrl, "buildUrl");

// api/search.js
var COLS = "id, word, traditional, pinyin, phonetic, definition, pos, tag, exchange, audio, source";
async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const mode = ["exact", "prefix", "fuzzy"].includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : "prefix";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const json = /* @__PURE__ */ __name((body, status) => new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }), "json");
  if (!q) return json({ error: "\u7F3A\u5C11\u67E5\u8BE2\u8BCD\uFF0C\u8BF7\u63D0\u4F9B q \u53C2\u6570" }, 400);
  let sql;
  let params;
  if (mode === "exact") {
    sql = "SELECT " + COLS + " FROM entries WHERE word = ? ORDER BY word LIMIT ?";
    params = [q, limit];
  } else if (mode === "fuzzy") {
    sql = "SELECT " + COLS + " FROM entries WHERE word LIKE ? OR phonetic LIKE ? OR definition LIKE ? ORDER BY word LIMIT ?";
    params = ["%" + q + "%", "%" + q + "%", "%" + q + "%", limit];
  } else {
    sql = "SELECT " + COLS + " FROM entries WHERE word LIKE ? ORDER BY word LIMIT ?";
    params = [q + "%", limit];
  }
  try {
    const conn = connect({ url: buildUrl(context.env) });
    const rows = await conn.execute(sql, params);
    return json({ query: q, mode, count: rows.length, results: rows });
  } catch (err) {
    console.error("search error:", err && err.message);
    return json({ error: "\u6570\u636E\u5E93\u67E5\u8BE2\u5931\u8D25", detail: err && err.message }, 500);
  }
}
__name(onRequestGet, "onRequestGet");

// health.js
async function onRequestGet2(context) {
  const json = /* @__PURE__ */ __name((body, status) => new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }), "json");
  try {
    const conn = connect({ url: buildUrl(context.env) });
    await conn.execute("SELECT 1");
    return json({ status: "ok", db: "up" });
  } catch (err) {
    return json({ status: "degraded", db: "down", error: err && err.message }, 503);
  }
}
__name(onRequestGet2, "onRequestGet");

// ../.wrangler/tmp/pages-Ms2xFE/functionsRoutes-0.6820484091599336.mjs
var routes = [
  {
    routePath: "/api/search",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/health",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  }
];

// ../../../../AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse2(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse2, "parse");
function match(str, options) {
  var keys = [];
  var re2 = pathToRegexp(str, keys, options);
  return regexpToFunction(re2, keys, options);
}
__name(match, "match");
function regexpToFunction(re2, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re2.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse2(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-QquHsG/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-QquHsG/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.10114816083656208.mjs.map

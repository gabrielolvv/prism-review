#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === ALIAS;
    var isDocument = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === DOC;
    var isMap = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === MAP;
    var isPair2 = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === PAIR;
    var isScalar = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === SCALAR;
    var isSeq = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === SEQ;
    function isCollection(node2) {
      if (node2 && typeof node2 === "object")
        switch (node2[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node2) {
      if (node2 && typeof node2 === "object")
        switch (node2[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node2) => (isScalar(node2) || isCollection(node2)) && !!node2.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair2;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node2, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node2)) {
        const cd = visit_(null, node2.contents, visitor_, Object.freeze([node2]));
        if (cd === REMOVE)
          node2.contents = null;
      } else
        visit_(null, node2, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node2, visitor, path2) {
      const ctrl = callVisitor(key, node2, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visit_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node2)) {
          path2 = Object.freeze(path2.concat(node2));
          for (let i = 0; i < node2.items.length; ++i) {
            const ci = visit_(i, node2.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node2.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node2)) {
          path2 = Object.freeze(path2.concat(node2));
          const ck = visit_("key", node2.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node2.key = null;
          const cv = visit_("value", node2.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node2.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node2, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node2)) {
        const cd = await visitAsync_(null, node2.contents, visitor_, Object.freeze([node2]));
        if (cd === REMOVE)
          node2.contents = null;
      } else
        await visitAsync_(null, node2, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node2, visitor, path2) {
      const ctrl = await callVisitor(key, node2, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visitAsync_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node2)) {
          path2 = Object.freeze(path2.concat(node2));
          for (let i = 0; i < node2.items.length; ++i) {
            const ci = await visitAsync_(i, node2.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node2.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node2)) {
          path2 = Object.freeze(path2.concat(node2));
          const ck = await visitAsync_("key", node2.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node2.key = null;
          const cv = await visitAsync_("value", node2.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node2.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node2, visitor, path2) {
      if (typeof visitor === "function")
        return visitor(key, node2, path2);
      if (identity.isMap(node2))
        return visitor.Map?.(key, node2, path2);
      if (identity.isSeq(node2))
        return visitor.Seq?.(key, node2, path2);
      if (identity.isPair(node2))
        return visitor.Pair?.(key, node2, path2);
      if (identity.isScalar(node2))
        return visitor.Scalar?.(key, node2, path2);
      if (identity.isAlias(node2))
        return visitor.Alias?.(key, node2, path2);
      return void 0;
    }
    function replaceNode(key, path2, node2) {
      const parent = path2[path2.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node2;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node2;
        else
          parent.value = node2;
      } else if (identity.isDocument(parent)) {
        parent.contents = node2;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version3] = parts;
            if (version3 === "1.1" || version3 === "1.2") {
              this.yaml.version = version3;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version3);
              onError(6, `Unsupported YAML version ${version3}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error2) {
            onError(String(error2));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node2) => {
            if (identity.isNode(node2) && node2.tag)
              tags[node2.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor2) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor2)) {
        const sa = JSON.stringify(anchor2);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node2) {
          if (node2.anchor)
            anchors.add(node2.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor2 = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor2);
          return anchor2;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error2 = new Error("Failed to resolve repeated object (this should not happen)");
              error2.source = source;
              throw error2;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node2) => {
              if (identity.isAlias(node2) || identity.hasAnchor(node2))
                nodes.push(node2);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node2 of nodes) {
          if (node2 === this)
            break;
          if (node2.anchor === this.source)
            found = node2;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node2, anchors2) {
      if (identity.isAlias(node2)) {
        const source = node2.resolve(doc);
        const anchor2 = anchors2 && source && anchors2.get(source);
        return anchor2 ? anchor2.count * anchor2.aliasCount : 0;
      } else if (identity.isCollection(node2)) {
        let count = 0;
        for (const item of node2.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node2)) {
        const kc = getAliasCount(doc, node2.key, anchors2);
        const vc = getAliasCount(doc, node2.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match2 = tags.filter((t) => t.tag === tagName);
        const tagObj = match2.find((t) => !t.format) ?? match2[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node3 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node3;
          return node3;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node2 = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node2.tag = tagName;
      else if (!tagObj.default)
        node2.tag = tagObj.tag;
      if (ref)
        ref.node = node2;
      return node2;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path2, value) {
      let v = value;
      for (let i = path2.length - 1; i >= 0; --i) {
        const k = path2[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path2, value) {
        if (isEmptyPath(path2))
          this.add(value);
        else {
          const [key, ...rest] = path2;
          const node2 = this.get(key, true);
          if (identity.isCollection(node2))
            node2.addIn(rest, value);
          else if (node2 === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.delete(key);
        const node2 = this.get(key, true);
        if (identity.isCollection(node2))
          return node2.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        const [key, ...rest] = path2;
        const node2 = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node2) ? node2.value : node2;
        else
          return identity.isCollection(node2) ? node2.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node2) => {
          if (!identity.isPair(node2))
            return false;
          const n = node2.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.has(key);
        const node2 = this.get(key, true);
        return identity.isCollection(node2) ? node2.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        const [key, ...rest] = path2;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node2 = this.get(key, true);
          if (identity.isCollection(node2))
            node2.setIn(rest, value);
          else if (node2 === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal3 = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal3 ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header2 = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header2 += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal3) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header2}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header2}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match2 = tags.filter((t) => t.tag === item.tag);
        if (match2.length > 0)
          return match2.find((t) => t.format === item.format) ?? match2[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match2 = tags.filter((t) => t.identify?.(obj));
        if (match2.length > 1) {
          const testMatch = match2.filter((t) => t.test);
          if (testMatch.length > 0)
            match2 = testMatch;
        }
        tagObj = match2.find((t) => t.format === item.format) ?? match2.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node2, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor2 = (identity.isScalar(node2) || identity.isCollection(node2)) && node2.anchor;
      if (anchor2 && anchors.anchorIsValid(anchor2)) {
        anchors$1.add(anchor2);
        props.push(`&${anchor2}`);
      }
      const tag = node2.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node2 = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node2));
      const props = stringifyProps(node2, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node2, ctx, onComment, onChompKeep) : identity.isScalar(node2) ? stringifyString.stringifyString(node2, ctx, onComment, onChompKeep) : node2.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node2) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge3 = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge3.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge3.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge3.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge3;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge3 = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge3.isMergeKey(ctx, key))
        merge3.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node2 of ctx.anchors.keys())
          strCtx.anchors.add(node2.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node2 = it?.value;
        return (!keepScalar && identity.isScalar(node2) ? node2.value : node2) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string3 = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string3;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node2) {
        const num = Number(node2.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node2);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node2 = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node2.minFractionDigits = str.length - dot - 1;
        return node2;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node2, radix, prefix) {
      const { value } = node2;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node2);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node2) => intStringify(node2, 8, "0o")
    };
    var int2 = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node2) => intStringify(node2, 16, "0x")
    };
    exports2.int = int2;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int2 = require_int();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null3.nullTag,
      bool.boolTag,
      int2.intOct,
      int2.int,
      int2.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node2) {
        const num = Number(node2.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node2);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node2 = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node2.minFractionDigits = f.length;
        }
        return node2;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node2, radix, prefix) {
      const { value } = node2;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node2);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node2) => intStringify(node2, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node2) => intStringify(node2, 8, "0")
    };
    var int2 = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node2) => intStringify(node2, 16, "0x")
    };
    exports2.int = int2;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node2) {
      let { value } = node2;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node2);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match2 = str.match(timestamp.test);
        if (!match2)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match2.map(Number);
        const millisec = match2[7] ? Number((match2[7] + "00").substr(1, 3)) : 0;
        let date2 = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match2[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date2 -= 6e4 * d;
        }
        return new Date(date2);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int2 = require_int2();
    var merge3 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null3.nullTag,
      bool.trueTag,
      bool.falseTag,
      int2.intBin,
      int2.intOct,
      int2.int,
      int2.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge3.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int2 = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge3 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string3.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int2.int,
      intHex: int2.intHex,
      intOct: int2.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge3.merge,
      null: _null3.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge3.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge3.merge) ? schemaTags.concat(merge3.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge3.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string3 = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge: merge3, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge3);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string3.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version: version3 } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version3 = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version: version3 });
        this.setSchema(version3, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path2, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path2, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node2, name) {
        if (!node2.anchor) {
          const prev = anchors.anchorNames(this);
          node2.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node2.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node2 = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node2))
          node2.flow = true;
        setAnchors();
        return node2;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        if (Collection.isEmptyPath(path2)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        if (Collection.isEmptyPath(path2))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path2) {
        if (Collection.isEmptyPath(path2))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        if (Collection.isEmptyPath(path2)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path2), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path2, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version3, options = {}) {
        if (typeof version3 === "number")
          version3 = String(version3);
        let opt;
        switch (version3) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version3;
            else
              this.directives = new directives.Directives({ version: version3 });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version3);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error2) => {
      if (error2.pos[0] === -1)
        return;
      error2.linePos = error2.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error2.linePos[0];
      error2.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error2.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error2.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor2 = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token2 of tokens) {
        if (reqSpace) {
          if (token2.type !== "space" && token2.type !== "newline" && token2.type !== "comma")
            onError(token2.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token2.type !== "comment" && token2.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token2.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token2.source.includes("	")) {
              tab = token2;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token2, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token2.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token2.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token2.source;
            atNewline = true;
            hasNewline = true;
            if (anchor2 || tag)
              newlineAfterProp = token2;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor2)
              onError(token2, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token2.source.endsWith(":"))
              onError(token2.offset + token2.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor2 = token2;
            start ?? (start = token2.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token2, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token2;
            start ?? (start = token2.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor2 || tag)
              onError(token2, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token2.source} indicator`);
            if (found)
              onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${token2.source} in ${flow ?? "collection"}`);
            found = token2;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token2, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token2;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${token2.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor: anchor2,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node2 = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node2.range[2];
        seq.items.push(node2);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token2 of end) {
          const { source, type } = token2;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token2, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token2) => token2 && (token2.type === "block-map" || token2.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token2, onError, tagName, tag) {
      const coll = token2.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token2, onError, tag) : token2.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token2, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token2, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token2, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token2.type === "block-seq") {
        const { anchor: anchor2, newlineAfterProp: nl } = props;
        const lastProp = anchor2 && tagToken ? anchor2.offset > tagToken.offset ? anchor2 : tagToken : anchor2 ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token2.type === "block-map" ? "map" : token2.type === "block-seq" ? "seq" : token2.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token2, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token2, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token2, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node2 = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node2.range = coll.range;
      node2.tag = tagName;
      if (tag?.format)
        node2.format = tag.format;
      return node2;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header2 = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header2)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header2.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header2.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header2.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header2.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header2.indent;
      let offset = scalar.offset + header2.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header2.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header2.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header2.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header2.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header2.length + scalar.source.length;
      return { value, type, comment: header2.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error2 = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error2 === -1)
            error2 = offset + i;
        }
      }
      if (error2 !== -1)
        onError(error2, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token2 = props[i];
        switch (token2.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token2.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token2, "MISSING_CHAR", message);
            }
            length += token2.source.length;
            comment = token2.source.substring(1);
            break;
          case "error":
            onError(token2, "UNEXPECTED_TOKEN", token2.message);
            length += token2.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token2.type}`;
            onError(token2, "UNEXPECTED_TOKEN", message);
            const ts = token2.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match2 = first.exec(source);
      if (!match2)
        return source;
      let res = match2[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match2 = line.exec(source)) {
        if (match2[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match2[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match2 = last.exec(source);
      return res + sep2 + (match2?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token2, tagToken, onError) {
      const { value, type, comment, range: range2 } = token2.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token2, onError) : resolveFlowScalar.resolveFlowScalar(token2, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token2.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token2, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token2, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error2) {
        const msg = error2 instanceof Error ? error2.message : String(error2);
        onError(tagToken ?? token2, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range2;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token2, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token2, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before2, pos) {
      if (before2) {
        pos ?? (pos = before2.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before2[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before2[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before2[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token2, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor: anchor2, tag } = props;
      let node2;
      let isSrcToken = true;
      switch (token2.type) {
        case "alias":
          node2 = composeAlias(ctx, token2, onError);
          if (anchor2 || tag)
            onError(token2, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node2 = composeScalar.composeScalar(ctx, token2, tag, onError);
          if (anchor2)
            node2.anchor = anchor2.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node2 = composeCollection.composeCollection(CN, ctx, token2, props, onError);
            if (anchor2)
              node2.anchor = anchor2.source.substring(1);
          } catch (error2) {
            const message = error2 instanceof Error ? error2.message : String(error2);
            onError(token2, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token2.type === "error" ? token2.message : `Unsupported token (type: ${token2.type})`;
          onError(token2, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node2 ?? (node2 = composeEmptyNode(ctx, token2.offset, void 0, null, props, onError));
      if (anchor2 && node2.anchor === "")
        onError(anchor2, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node2) || typeof node2.value !== "string" || node2.tag && node2.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token2, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node2.spaceBefore = true;
      if (comment) {
        if (token2.type === "scalar" && token2.source === "")
          node2.comment = comment;
        else
          node2.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node2.srcToken = token2;
      return node2;
    }
    function composeEmptyNode(ctx, offset, before2, pos, { spaceBefore, comment, anchor: anchor2, tag, end }, onError) {
      const token2 = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before2, pos),
        indent: -1,
        source: ""
      };
      const node2 = composeScalar.composeScalar(ctx, token2, tag, onError);
      if (anchor2) {
        node2.anchor = anchor2.source.substring(1);
        if (node2.anchor === "")
          onError(anchor2, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node2.spaceBefore = true;
      if (comment) {
        node2.comment = comment;
        node2.range[2] = end;
      }
      return node2;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token2 of tokens)
          yield* this.next(token2);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token2) {
        if (node_process.env.LOG_STREAM)
          console.dir(token2, { depth: null });
        switch (token2.type) {
          case "directive":
            this.directives.add(token2.source, (offset, message, warning) => {
              const pos = getErrorPos(token2);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token2.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token2, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token2, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token2.source);
            break;
          case "error": {
            const msg = token2.source ? `${token2.message}: ${JSON.stringify(token2.source)}` : token2.message;
            const error2 = new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error2);
            else
              this.doc.errors.push(error2);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token2.end, token2.offset + token2.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", `Unsupported token ${token2.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token2, strict = true, onError) {
      if (token2) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token2.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token2, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token2, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token2, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token2 ? token2.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token2.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header2 = token2.props[0];
            if (header2.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header2.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token2, source);
          break;
        case '"':
          setFlowScalarValue(token2, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token2, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token2, source, "scalar");
      }
    }
    function setBlockScalarValue(token2, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token2.type === "block-scalar") {
        const header2 = token2.props[0];
        if (header2.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header2.source = head;
        token2.source = body;
      } else {
        const { offset } = token2;
        const indent = "indent" in token2 ? token2.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token2 ? token2.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token2))
          if (key !== "type" && key !== "offset")
            delete token2[key];
        Object.assign(token2, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token2, source, type) {
      switch (token2.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token2.type = type;
          token2.source = source;
          break;
        case "block-scalar": {
          const end = token2.props.slice(1);
          let oa = source.length;
          if (token2.props[0].type === "block-scalar-header")
            oa -= token2.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token2.props;
          Object.assign(token2, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token2.offset + source.length;
          const nl = { type: "newline", offset, indent: token2.indent, source: "\n" };
          delete token2.items;
          Object.assign(token2, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token2 ? token2.indent : -1;
          const end = "end" in token2 && Array.isArray(token2.end) ? token2.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token2))
            if (key !== "type" && key !== "offset")
              delete token2[key];
          Object.assign(token2, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token2) {
      switch (token2.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token2.props)
            res += stringifyToken(tok);
          return res + token2.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token2.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token2.start.source;
          for (const item of token2.items)
            res += stringifyItem(item);
          for (const st of token2.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token2);
          if (token2.end)
            for (const st of token2.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token2.source;
          if ("end" in token2 && token2.end)
            for (const st of token2.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path2) => {
      let item = cst;
      for (const [field, index] of path2) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path2) => {
      const parent = visit.itemAtPath(cst, path2.slice(0, -1));
      const field = path2[path2.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path2, item, visitor) {
      let ctrl = visitor(item, path2);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token2 = item[field];
        if (token2 && "items" in token2) {
          for (let i = 0; i < token2.items.length; ++i) {
            const ci = _visit(Object.freeze(path2.concat([[field, i]])), token2.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token2.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path2);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token2) => !!token2 && "items" in token2;
    var isScalar = (token2) => !!token2 && (token2.type === "scalar" || token2.type === "single-quoted-scalar" || token2.type === "double-quoted-scalar" || token2.type === "block-scalar");
    function prettyToken(token2) {
      switch (token2) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token2);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list2, type) {
      for (let i = 0; i < list2.length; ++i)
        if (list2[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list2) {
      for (let i = 0; i < list2.length; ++i) {
        switch (list2[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token2) {
      switch (token2?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser2 = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error2) {
        const token2 = error2 ?? this.stack.pop();
        if (!token2) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token2;
        } else {
          const top = this.peek(1);
          if (token2.type === "block-scalar") {
            token2.indent = "indent" in top ? top.indent : 0;
          } else if (token2.type === "flow-collection" && top.type === "document") {
            token2.indent = 0;
          }
          if (token2.type === "flow-collection")
            fixFlowSeqItems(token2);
          switch (top.type) {
            case "document":
              top.value = token2;
              break;
            case "block-scalar":
              top.props.push(token2);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token2, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token2;
              } else {
                Object.assign(it, { key: token2, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token2 });
              else
                it.value = token2;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token2, sep: [] });
              else if (it.sep)
                it.value = token2;
              else
                Object.assign(it, { key: token2, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token2);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token2.type === "block-map" || token2.type === "block-seq")) {
            const last = token2.items[token2.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token2.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token2.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token2.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token2) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token2.end)
              token2.end.push(this.sourceToken);
            else
              token2.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser2;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse4(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse4;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// src/cli/main.ts
var import_node_child_process = require("node:child_process");
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");

// node_modules/balanced-match/dist/esm/index.js
var balanced = (a, b, str) => {
  const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
  const mb = b instanceof RegExp ? maybeMatch(b, str) : b;
  const r = ma !== null && mb != null && range(ma, mb, str);
  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + ma.length, r[1]),
    post: str.slice(r[1] + mb.length)
  };
};
var maybeMatch = (reg, str) => {
  const m = str.match(reg);
  return m ? m[0] : null;
};
var range = (a, b, str) => {
  let begs, beg, left, right = void 0, result;
  let ai = str.indexOf(a);
  let bi = str.indexOf(b, ai + 1);
  let i = ai;
  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;
    while (i >= 0 && !result) {
      if (i === ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length === 1) {
        const r = begs.pop();
        if (r !== void 0)
          result = [r, bi];
      } else {
        beg = begs.pop();
        if (beg !== void 0 && beg < left) {
          left = beg;
          right = bi;
        }
        bi = str.indexOf(b, i + 1);
      }
      i = ai < bi && ai >= 0 ? ai : bi;
    }
    if (begs.length && right !== void 0) {
      result = [left, right];
    }
  }
  return result;
};

// node_modules/brace-expansion/dist/esm/index.js
var escSlash = "\0SLASH" + Math.random() + "\0";
var escOpen = "\0OPEN" + Math.random() + "\0";
var escClose = "\0CLOSE" + Math.random() + "\0";
var escComma = "\0COMMA" + Math.random() + "\0";
var escPeriod = "\0PERIOD" + Math.random() + "\0";
var escSlashPattern = new RegExp(escSlash, "g");
var escOpenPattern = new RegExp(escOpen, "g");
var escClosePattern = new RegExp(escClose, "g");
var escCommaPattern = new RegExp(escComma, "g");
var escPeriodPattern = new RegExp(escPeriod, "g");
var slashPattern = /\\\\/g;
var openPattern = /\\{/g;
var closePattern = /\\}/g;
var commaPattern = /\\,/g;
var periodPattern = /\\\./g;
var EXPANSION_MAX = 1e5;
var EXPANSION_MAX_LENGTH = 4e6;
var EXPANSION_MAX_DEPTH = 1e3;
var EXPANSION_MAX_REWRITES = 1e3;
function numeric(str) {
  return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
}
function escapeBraces(str) {
  return str.replace(slashPattern, escSlash).replace(openPattern, escOpen).replace(closePattern, escClose).replace(commaPattern, escComma).replace(periodPattern, escPeriod);
}
function unescapeBraces(str) {
  return str.replace(escSlashPattern, "\\").replace(escOpenPattern, "{").replace(escClosePattern, "}").replace(escCommaPattern, ",").replace(escPeriodPattern, ".");
}
function pushAll(target, items) {
  for (let i = 0; i < items.length; i++) {
    target.push(items[i]);
  }
}
function parseCommaParts(str) {
  const parts = [];
  let carry = "";
  for (; ; ) {
    const m = balanced("{", "}", str);
    if (!m) {
      const tail = str.split(",");
      tail[0] = carry + tail[0];
      pushAll(parts, tail);
      return parts;
    }
    const { pre, body, post } = m;
    const p = pre.split(",");
    p[0] = carry + p[0];
    p[p.length - 1] += "{" + body + "}";
    if (!post.length) {
      pushAll(parts, p);
      return parts;
    }
    carry = p.pop();
    pushAll(parts, p);
    str = post;
  }
}
function expand(str, options = {}) {
  if (!str) {
    return [];
  }
  const { max = EXPANSION_MAX, maxLength = EXPANSION_MAX_LENGTH, maxDepth: maxDepth2 = EXPANSION_MAX_DEPTH, maxRewrites = EXPANSION_MAX_REWRITES } = options;
  if (str.slice(0, 2) === "{}") {
    str = "\\{\\}" + str.slice(2);
  }
  return expand_(escapeBraces(str), max, maxLength, maxDepth2, 0, maxRewrites, true).map(unescapeBraces);
}
function embrace(str) {
  return "{" + str + "}";
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}
function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}
function combine(acc, pre, values, max, maxLength, dropEmpties) {
  const out = [];
  let length = 0;
  for (let a = 0; a < acc.length; a++) {
    for (let v = 0; v < values.length; v++) {
      if (out.length >= max)
        return out;
      const expansion = acc[a] + pre + values[v];
      if (dropEmpties && !expansion)
        continue;
      if (length + expansion.length > maxLength)
        return out;
      out.push(expansion);
      length += expansion.length;
    }
  }
  return out;
}
function expandSequence(body, isAlphaSequence, max, maxLength) {
  const n = body.split(/\.\./);
  const N = [];
  if (n[0] === void 0 || n[1] === void 0) {
    return N;
  }
  const x = numeric(n[0]);
  const y = numeric(n[1]);
  const width = Math.max(n[0].length, n[1].length);
  let incr = n.length === 3 && n[2] !== void 0 ? Math.max(Math.abs(numeric(n[2])), 1) : 1;
  let test = lte;
  const reverse = y < x;
  if (reverse) {
    incr *= -1;
    test = gte;
  }
  const pad = n.some(isPadded);
  let length = 0;
  for (let i = x; test(i, y) && N.length < max; i += incr) {
    let c;
    if (isAlphaSequence) {
      c = String.fromCharCode(i);
      if (c === "\\") {
        c = "";
      }
    } else {
      c = String(i);
      if (pad) {
        const need = width - c.length;
        if (need > 0) {
          const z = new Array(need + 1).join("0");
          if (i < 0) {
            c = "-" + z + c.slice(1);
          } else {
            c = z + c;
          }
        }
      }
    }
    if (length + c.length > maxLength)
      break;
    N.push(c);
    length += c.length;
  }
  return N;
}
function expand_(str, max, maxLength, maxDepth2, depth, maxRewrites, isTop) {
  if (depth > maxDepth2) {
    return [str];
  }
  let acc = [""];
  let rewrites = 0;
  let dropEmpties = false;
  let firstGroup = true;
  for (; ; ) {
    const m = balanced("{", "}", str);
    if (!m) {
      return combine(acc, str, [""], max, maxLength, dropEmpties);
    }
    const pre = m.pre;
    if (/\$$/.test(pre)) {
      acc = combine(acc, pre + "{" + m.body + "}", [""], max, maxLength, dropEmpties && !m.post.length);
      firstGroup = false;
      if (!m.post.length)
        break;
      str = m.post;
      continue;
    }
    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    const isSequence = isNumericSequence || isAlphaSequence;
    const isOptions = m.body.indexOf(",") >= 0;
    if (!isSequence && !isOptions) {
      if (rewrites < maxRewrites && m.post.match(/,(?!,).*\}/)) {
        rewrites++;
        str = m.pre + "{" + m.body + escClose + m.post;
        isTop = true;
        continue;
      }
      return combine(acc, pre + "{" + m.body + "}" + m.post, [""], max, maxLength, dropEmpties);
    }
    if (firstGroup) {
      dropEmpties = isTop && !isSequence;
      firstGroup = false;
    }
    let values;
    if (isSequence) {
      values = expandSequence(m.body, isAlphaSequence, max, maxLength);
    } else {
      let n = parseCommaParts(m.body);
      if (n.length === 1 && n[0] !== void 0) {
        n = expand_(n[0], max, maxLength, maxDepth2, depth + 1, maxRewrites, false).map(embrace);
        if (n.length === 1) {
          acc = combine(acc, pre + n[0], [""], max, maxLength, dropEmpties && !m.post.length);
          if (!m.post.length)
            break;
          str = m.post;
          continue;
        }
      }
      let dropsEmpties = dropEmpties && !m.post.length && !pre;
      for (let d = 0; dropsEmpties && d < acc.length; d++) {
        if (acc[d]) {
          dropsEmpties = false;
        }
      }
      values = [];
      let valuesLength = 0;
      outer: for (let j = 0; j < n.length; j++) {
        const expanded = expand_(n[j], max, maxLength, maxDepth2, depth + 1, maxRewrites, false);
        for (let k = 0; k < expanded.length; k++) {
          const v = expanded[k];
          if (dropsEmpties && !v)
            continue;
          if (values.length >= max || valuesLength + v.length > maxLength) {
            break outer;
          }
          values.push(v);
          valuesLength += v.length;
        }
      }
    }
    acc = combine(acc, pre, values, max, maxLength, dropEmpties && !m.post.length);
    if (!m.post.length)
      break;
    str = m.post;
  }
  return acc;
}

// node_modules/minimatch/dist/esm/assert-valid-pattern.js
var MAX_PATTERN_LENGTH = 1024 * 64;
var assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};

// node_modules/minimatch/dist/esm/brace-expressions.js
var posixClasses = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x00-\\x7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false]
};
var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var rangesToString = (ranges) => ranges.join("");
var parseClass = (glob, position) => {
  const pos = position;
  if (glob.charAt(pos) !== "[") {
    throw new Error("not in a brace expression");
  }
  const ranges = [];
  const negs = [];
  let i = pos + 1;
  let sawStart = false;
  let uflag = false;
  let escaping = false;
  let negate = false;
  let endPos = pos;
  let rangeStart = "";
  WHILE: while (i < glob.length) {
    const c = glob.charAt(i);
    if ((c === "!" || c === "^") && i === pos + 1) {
      negate = true;
      i++;
      continue;
    }
    if (c === "]" && sawStart && !escaping) {
      endPos = i + 1;
      break;
    }
    sawStart = true;
    if (c === "\\") {
      if (!escaping) {
        escaping = true;
        i++;
        continue;
      }
    }
    if (c === "[" && !escaping) {
      for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
        if (glob.startsWith(cls, i)) {
          if (rangeStart) {
            return ["$.", false, glob.length - pos, true];
          }
          i += cls.length;
          if (neg)
            negs.push(unip);
          else
            ranges.push(unip);
          uflag = uflag || u;
          continue WHILE;
        }
      }
    }
    escaping = false;
    if (rangeStart) {
      if (c > rangeStart) {
        ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
      } else if (c === rangeStart) {
        ranges.push(braceEscape(c));
      }
      rangeStart = "";
      i++;
      continue;
    }
    if (glob.startsWith("-]", i + 1)) {
      ranges.push(braceEscape(c + "-"));
      i += 2;
      continue;
    }
    if (glob.startsWith("-", i + 1)) {
      rangeStart = c;
      i += 2;
      continue;
    }
    ranges.push(braceEscape(c));
    i++;
  }
  if (endPos < i) {
    return ["", false, 0, false];
  }
  if (!ranges.length && !negs.length) {
    return ["$.", false, glob.length - pos, true];
  }
  if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
    const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
    return [regexpEscape(r), false, endPos - pos, false];
  }
  const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
  const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
  const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
  return [comb, uflag, endPos - pos, true];
};

// node_modules/minimatch/dist/esm/unescape.js
var unescape = (s, { windowsPathsNoEscape = false, magicalBraces = true } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/\[([^/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^/\\])\]/g, "$1$2").replace(/\\([^/])/g, "$1");
  }
  return windowsPathsNoEscape ? s.replace(/\[([^/\\{}])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^/\\{}])\]/g, "$1$2").replace(/\\([^/{}])/g, "$1");
};

// node_modules/minimatch/dist/esm/ast.js
var _a;
var types = /* @__PURE__ */ new Set(["!", "?", "+", "*", "@"]);
var isExtglobType = (c) => types.has(c);
var isExtglobAST = (c) => isExtglobType(c.type);
var adoptionMap = /* @__PURE__ */ new Map([
  ["!", ["@"]],
  ["?", ["?", "@"]],
  ["@", ["@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@"]]
]);
var adoptionWithSpaceMap = /* @__PURE__ */ new Map([
  ["!", ["?"]],
  ["@", ["?"]],
  ["+", ["?", "*"]]
]);
var adoptionAnyMap = /* @__PURE__ */ new Map([
  ["!", ["?", "@"]],
  ["?", ["?", "@"]],
  ["@", ["?", "@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@", "?", "*"]]
]);
var usurpMap = /* @__PURE__ */ new Map([
  ["!", /* @__PURE__ */ new Map([["!", "@"]])],
  [
    "?",
    /* @__PURE__ */ new Map([
      ["*", "*"],
      ["+", "*"]
    ])
  ],
  [
    "@",
    /* @__PURE__ */ new Map([
      ["!", "!"],
      ["?", "?"],
      ["@", "@"],
      ["*", "*"],
      ["+", "+"]
    ])
  ],
  [
    "+",
    /* @__PURE__ */ new Map([
      ["?", "*"],
      ["*", "*"]
    ])
  ]
]);
var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
var startNoDot = "(?!\\.)";
var addPatternStart = /* @__PURE__ */ new Set(["[", "."]);
var justDots = /* @__PURE__ */ new Set(["..", "."]);
var reSpecials = new Set("().*{}+?[]^$\\!");
var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var qmark = "[^/]";
var star = qmark + "*?";
var starNoEmpty = qmark + "+?";
var ID = 0;
var AST = class {
  type;
  #root;
  #hasMagic;
  #uflag = false;
  #parts = [];
  #parent;
  #parentIndex;
  #negs;
  #filledNegs = false;
  #options;
  #toString;
  // set to true if it's an extglob with no children
  // (which really means one child of '')
  #emptyExt = false;
  id = ++ID;
  get depth() {
    return (this.#parent?.depth ?? -1) + 1;
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return {
      "@@type": "AST",
      id: this.id,
      type: this.type,
      root: this.#root.id,
      parent: this.#parent?.id,
      depth: this.depth,
      partsLength: this.#parts.length,
      parts: this.#parts
    };
  }
  constructor(type, parent, options = {}) {
    this.type = type;
    if (type)
      this.#hasMagic = true;
    this.#parent = parent;
    this.#root = this.#parent ? this.#parent.#root : this;
    this.#options = this.#root === this ? options : this.#root.#options;
    this.#negs = this.#root === this ? [] : this.#root.#negs;
    if (type === "!" && !this.#root.#filledNegs)
      this.#negs.push(this);
    this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
  }
  get hasMagic() {
    if (this.#hasMagic !== void 0)
      return this.#hasMagic;
    for (const p of this.#parts) {
      if (typeof p === "string")
        continue;
      if (p.type || p.hasMagic)
        return this.#hasMagic = true;
    }
    return this.#hasMagic;
  }
  // reconstructs the pattern
  toString() {
    return this.#toString !== void 0 ? this.#toString : !this.type ? this.#toString = this.#parts.map((p) => String(p)).join("") : this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
  }
  #fillNegs() {
    if (this !== this.#root)
      throw new Error("should only call on root");
    if (this.#filledNegs)
      return this;
    this.toString();
    this.#filledNegs = true;
    let n;
    while (n = this.#negs.pop()) {
      if (n.type !== "!")
        continue;
      let p = n;
      let pp = p.#parent;
      while (pp) {
        for (let i = p.#parentIndex + 1; !pp.type && i < pp.#parts.length; i++) {
          for (const part of n.#parts) {
            if (typeof part === "string") {
              throw new Error("string part in extglob AST??");
            }
            part.copyIn(pp.#parts[i]);
          }
        }
        p = pp;
        pp = p.#parent;
      }
    }
    return this;
  }
  push(...parts) {
    for (const p of parts) {
      if (p === "")
        continue;
      if (typeof p !== "string" && !(p instanceof _a && p.#parent === this)) {
        throw new Error("invalid part: " + p);
      }
      this.#parts.push(p);
    }
  }
  toJSON() {
    const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
    if (this.isStart() && !this.type)
      ret.unshift([]);
    if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) {
      ret.push({});
    }
    return ret;
  }
  isStart() {
    if (this.#root === this)
      return true;
    if (!this.#parent?.isStart())
      return false;
    if (this.#parentIndex === 0)
      return true;
    const p = this.#parent;
    for (let i = 0; i < this.#parentIndex; i++) {
      const pp = p.#parts[i];
      if (!(pp instanceof _a && pp.type === "!")) {
        return false;
      }
    }
    return true;
  }
  isEnd() {
    if (this.#root === this)
      return true;
    if (this.#parent?.type === "!")
      return true;
    if (!this.#parent?.isEnd())
      return false;
    if (!this.type)
      return this.#parent?.isEnd();
    const pl = this.#parent ? this.#parent.#parts.length : 0;
    return this.#parentIndex === pl - 1;
  }
  copyIn(part) {
    if (typeof part === "string")
      this.push(part);
    else
      this.push(part.clone(this));
  }
  clone(parent) {
    const c = new _a(this.type, parent);
    for (const p of this.#parts) {
      c.copyIn(p);
    }
    return c;
  }
  static #parseAST(str, ast, pos, opt, extDepth) {
    const maxDepth2 = opt.maxExtglobRecursion ?? 2;
    let escaping = false;
    let inBrace = false;
    let braceStart = -1;
    let braceNeg = false;
    if (ast.type === null) {
      let i2 = pos;
      let acc2 = "";
      while (i2 < str.length) {
        const c = str.charAt(i2++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc2 += c;
          continue;
        }
        if (inBrace) {
          if (i2 === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i2 === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc2 += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i2;
          braceNeg = false;
          acc2 += c;
          continue;
        }
        const doRecurse = !opt.noext && isExtglobType(c) && str.charAt(i2) === "(" && extDepth <= maxDepth2;
        if (doRecurse) {
          ast.push(acc2);
          acc2 = "";
          const ext2 = new _a(c, ast);
          i2 = _a.#parseAST(str, ext2, i2, opt, extDepth + 1);
          ast.push(ext2);
          continue;
        }
        acc2 += c;
      }
      ast.push(acc2);
      return i2;
    }
    let i = pos + 1;
    let part = new _a(null, ast);
    const parts = [];
    let acc = "";
    while (i < str.length) {
      const c = str.charAt(i++);
      if (escaping || c === "\\") {
        escaping = !escaping;
        acc += c;
        continue;
      }
      if (inBrace) {
        if (i === braceStart + 1) {
          if (c === "^" || c === "!") {
            braceNeg = true;
          }
        } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
          inBrace = false;
        }
        acc += c;
        continue;
      } else if (c === "[") {
        inBrace = true;
        braceStart = i;
        braceNeg = false;
        acc += c;
        continue;
      }
      const doRecurse = !opt.noext && isExtglobType(c) && str.charAt(i) === "(" && /* c8 ignore start - the maxDepth is sufficient here */
      (extDepth <= maxDepth2 || ast && ast.#canAdoptType(c));
      if (doRecurse) {
        const depthAdd = ast && ast.#canAdoptType(c) ? 0 : 1;
        part.push(acc);
        acc = "";
        const ext2 = new _a(c, part);
        part.push(ext2);
        i = _a.#parseAST(str, ext2, i, opt, extDepth + depthAdd);
        continue;
      }
      if (c === "|") {
        part.push(acc);
        acc = "";
        parts.push(part);
        part = new _a(null, ast);
        continue;
      }
      if (c === ")") {
        if (acc === "" && ast.#parts.length === 0) {
          ast.#emptyExt = true;
        }
        part.push(acc);
        acc = "";
        ast.push(...parts, part);
        return i;
      }
      acc += c;
    }
    ast.type = null;
    ast.#hasMagic = void 0;
    ast.#parts = [str.substring(pos - 1)];
    return i;
  }
  #canAdoptWithSpace(child) {
    return this.#canAdopt(child, adoptionWithSpaceMap);
  }
  #canAdopt(child, map = adoptionMap) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canAdoptType(gc.type, map);
  }
  #canAdoptType(c, map = adoptionAnyMap) {
    return !!map.get(this.type)?.includes(c);
  }
  #adoptWithSpace(child, index) {
    const gc = child.#parts[0];
    const blank = new _a(null, gc, this.options);
    blank.#parts.push("");
    gc.push(blank);
    this.#adopt(child, index);
  }
  #adopt(child, index) {
    const gc = child.#parts[0];
    this.#parts.splice(index, 1, ...gc.#parts);
    for (const p of gc.#parts) {
      if (typeof p === "object")
        p.#parent = this;
    }
    this.#toString = void 0;
  }
  #canUsurpType(c) {
    const m = usurpMap.get(this.type);
    return !!m?.has(c);
  }
  #canUsurp(child) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null || this.#parts.length !== 1) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canUsurpType(gc.type);
  }
  #usurp(child) {
    const m = usurpMap.get(this.type);
    const gc = child.#parts[0];
    const nt = m?.get(gc.type);
    if (!nt)
      return false;
    this.#parts = gc.#parts;
    for (const p of this.#parts) {
      if (typeof p === "object") {
        p.#parent = this;
      }
    }
    this.type = nt;
    this.#toString = void 0;
    this.#emptyExt = false;
  }
  static fromGlob(pattern, options = {}) {
    const ast = new _a(null, void 0, options);
    _a.#parseAST(pattern, ast, 0, options, 0);
    return ast;
  }
  // returns the regular expression if there's magic, or the unescaped
  // string if not.
  toMMPattern() {
    if (this !== this.#root)
      return this.#root.toMMPattern();
    const glob = this.toString();
    const [re, body, hasMagic, uflag] = this.toRegExpSource();
    const anyMagic = hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase();
    if (!anyMagic) {
      return body;
    }
    const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
    return Object.assign(new RegExp(`^${re}$`, flags), {
      _src: re,
      _glob: glob
    });
  }
  get options() {
    return this.#options;
  }
  // returns the string match, the regexp source, whether there's magic
  // in the regexp (so a regular expression is required) and whether or
  // not the uflag is needed for the regular expression (for posix classes)
  // TODO: instead of injecting the start/end at this point, just return
  // the BODY of the regexp, along with the start/end portions suitable
  // for binding the start/end in either a joined full-path makeRe context
  // (where we bind to (^|/), or a standalone matchPart context (where
  // we bind to ^, and not /).  Otherwise slashes get duped!
  //
  // In part-matching mode, the start is:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: ^(?!\.\.?$)
  // - if dots allowed or not possible: ^
  // - if dots possible and not allowed: ^(?!\.)
  // end is:
  // - if not isEnd(): nothing
  // - else: $
  //
  // In full-path matching mode, we put the slash at the START of the
  // pattern, so start is:
  // - if first pattern: same as part-matching mode
  // - if not isStart(): nothing
  // - if traversal possible, but not allowed: /(?!\.\.?(?:$|/))
  // - if dots allowed or not possible: /
  // - if dots possible and not allowed: /(?!\.)
  // end is:
  // - if last pattern, same as part-matching mode
  // - else nothing
  //
  // Always put the (?:$|/) on negated tails, though, because that has to be
  // there to bind the end of the negated pattern portion, and it's easier to
  // just stick it in now rather than try to inject it later in the middle of
  // the pattern.
  //
  // We can just always return the same end, and leave it up to the caller
  // to know whether it's going to be used joined or in parts.
  // And, if the start is adjusted slightly, can do the same there:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: (?:/|^)(?!\.\.?$)
  // - if dots allowed or not possible: (?:/|^)
  // - if dots possible and not allowed: (?:/|^)(?!\.)
  //
  // But it's better to have a simpler binding without a conditional, for
  // performance, so probably better to return both start options.
  //
  // Then the caller just ignores the end if it's not the first pattern,
  // and the start always gets applied.
  //
  // But that's always going to be $ if it's the ending pattern, or nothing,
  // so the caller can just attach $ at the end of the pattern when building.
  //
  // So the todo is:
  // - better detect what kind of start is needed
  // - return both flavors of starting pattern
  // - attach $ at the end of the pattern when creating the actual RegExp
  //
  // Ah, but wait, no, that all only applies to the root when the first pattern
  // is not an extglob. If the first pattern IS an extglob, then we need all
  // that dot prevention biz to live in the extglob portions, because eg
  // +(*|.x*) can match .xy but not .yx.
  //
  // So, return the two flavors if it's #root and the first child is not an
  // AST, otherwise leave it to the child AST to handle it, and there,
  // use the (?:^|/) style of start binding.
  //
  // Even simplified further:
  // - Since the start for a join is eg /(?!\.) and the start for a part
  // is ^(?!\.), we can just prepend (?!\.) to the pattern (either root
  // or start or whatever) and prepend ^ or / at the Regexp construction.
  toRegExpSource(allowDot) {
    const dot = allowDot ?? !!this.#options.dot;
    if (this.#root === this) {
      this.#flatten();
      this.#fillNegs();
    }
    if (!isExtglobAST(this)) {
      const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => typeof s !== "string");
      const src = this.#parts.map((p) => {
        const [re, _, hasMagic, uflag] = typeof p === "string" ? _a.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
        this.#hasMagic = this.#hasMagic || hasMagic;
        this.#uflag = this.#uflag || uflag;
        return re;
      }).join("");
      let start2 = "";
      if (this.isStart()) {
        if (typeof this.#parts[0] === "string") {
          const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
          if (!dotTravAllowed) {
            const aps = addPatternStart;
            const needNoTrav = (
              // dots are allowed, and the pattern starts with [ or .
              dot && aps.has(src.charAt(0)) || // the pattern starts with \., and then [ or .
              src.startsWith("\\.") && aps.has(src.charAt(2)) || // the pattern starts with \.\., and then [ or .
              src.startsWith("\\.\\.") && aps.has(src.charAt(4))
            );
            const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
            start2 = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
          }
        }
      }
      let end = "";
      if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
        end = "(?:$|\\/)";
      }
      const final2 = start2 + src + end;
      return [
        final2,
        unescape(src),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    const repeated = this.type === "*" || this.type === "+";
    const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
    let body = this.#partsToRegExp(dot);
    if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
      const s = this.toString();
      const me = this;
      me.#parts = [s];
      me.type = null;
      me.#hasMagic = void 0;
      return [s, unescape(this.toString()), false, false];
    }
    let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
    if (bodyDotAllowed === body) {
      bodyDotAllowed = "";
    }
    if (bodyDotAllowed) {
      body = `(?:${body})(?:${bodyDotAllowed})*?`;
    }
    let final = "";
    if (this.type === "!" && this.#emptyExt) {
      final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
    } else {
      const close = this.type === "!" ? (
        // !() must match something,but !(x) can match ''
        "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")"
      ) : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
      final = start + body + close;
    }
    return [
      final,
      unescape(body),
      this.#hasMagic = !!this.#hasMagic,
      this.#uflag
    ];
  }
  #flatten() {
    if (!isExtglobAST(this)) {
      for (const p of this.#parts) {
        if (typeof p === "object") {
          p.#flatten();
        }
      }
    } else {
      let iterations = 0;
      let done = false;
      do {
        done = true;
        for (let i = 0; i < this.#parts.length; i++) {
          const c = this.#parts[i];
          if (typeof c === "object") {
            c.#flatten();
            if (this.#canAdopt(c)) {
              done = false;
              this.#adopt(c, i);
            } else if (this.#canAdoptWithSpace(c)) {
              done = false;
              this.#adoptWithSpace(c, i);
            } else if (this.#canUsurp(c)) {
              done = false;
              this.#usurp(c);
            }
          }
        }
      } while (!done && ++iterations < 10);
    }
    this.#toString = void 0;
  }
  #partsToRegExp(dot) {
    return this.#parts.map((p) => {
      if (typeof p === "string") {
        throw new Error("string type in extglob ast??");
      }
      const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
      this.#uflag = this.#uflag || uflag;
      return re;
    }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
  }
  static #parseGlob(glob, hasMagic, noEmpty = false) {
    let escaping = false;
    let re = "";
    let uflag = false;
    let inStar = false;
    for (let i = 0; i < glob.length; i++) {
      const c = glob.charAt(i);
      if (escaping) {
        escaping = false;
        re += (reSpecials.has(c) ? "\\" : "") + c;
        continue;
      }
      if (c === "*") {
        if (inStar)
          continue;
        inStar = true;
        re += noEmpty && /^[*]+$/.test(glob) ? starNoEmpty : star;
        hasMagic = true;
        continue;
      } else {
        inStar = false;
      }
      if (c === "\\") {
        if (i === glob.length - 1) {
          re += "\\\\";
        } else {
          escaping = true;
        }
        continue;
      }
      if (c === "[") {
        const [src, needUflag, consumed, magic] = parseClass(glob, i);
        if (consumed) {
          re += src;
          uflag = uflag || needUflag;
          i += consumed - 1;
          hasMagic = hasMagic || magic;
          continue;
        }
      }
      if (c === "?") {
        re += qmark;
        hasMagic = true;
        continue;
      }
      re += regExpEscape(c);
    }
    return [re, unescape(glob), !!hasMagic, uflag];
  }
};
_a = AST;

// node_modules/minimatch/dist/esm/escape.js
var escape = (s, { windowsPathsNoEscape = false, magicalBraces = false } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
  }
  return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// node_modules/minimatch/dist/esm/index.js
var minimatch = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch(pattern, options).match(p);
};
var starDotExtRE = /^\*+([^+@!?*[(]*)$/;
var starDotExtTest = (ext2) => (f) => !f.startsWith(".") && f.endsWith(ext2);
var starDotExtTestDot = (ext2) => (f) => f.endsWith(ext2);
var starDotExtTestNocase = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext2);
};
var starDotExtTestNocaseDot = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => f.toLowerCase().endsWith(ext2);
};
var starDotStarRE = /^\*+\.\*+$/;
var starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
var starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
var dotStarRE = /^\.\*+$/;
var dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
var starRE = /^\*+$/;
var starTest = (f) => f.length !== 0 && !f.startsWith(".");
var starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
var qmarksRE = /^\?+([^+@!?*[(]*)?$/;
var qmarksTestNocase = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestNocaseDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTest = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTestNoExt = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && !f.startsWith(".");
};
var qmarksTestNoExtDot = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && f !== "." && f !== "..";
};
var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
var path = {
  win32: { sep: "\\" },
  posix: { sep: "/" }
};
var sep = defaultPlatform === "win32" ? path.win32.sep : path.posix.sep;
minimatch.sep = sep;
var GLOBSTAR = /* @__PURE__ */ Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
var qmark2 = "[^/]";
var star2 = qmark2 + "*?";
var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
var filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
var ext = (a, b = {}) => Object.assign({}, a, b);
var defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch;
  }
  const orig = minimatch;
  const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern, options = {}) {
        super(pattern, ext(def, options));
      }
      static defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      }
    },
    AST: class AST extends orig.AST {
      /* c8 ignore start */
      constructor(type, parent, options = {}) {
        super(type, parent, ext(def, options));
      }
      /* c8 ignore stop */
      static fromGlob(pattern, options = {}) {
        return orig.AST.fromGlob(pattern, ext(def, options));
      }
    },
    unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
    escape: (s, options = {}) => orig.escape(s, ext(def, options)),
    filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
    defaults: (options) => orig.defaults(ext(def, options)),
    makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
    braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
    match: (list2, pattern, options = {}) => orig.match(list2, pattern, ext(def, options)),
    sep: orig.sep,
    GLOBSTAR
  });
};
minimatch.defaults = defaults;
var braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return expand(pattern, { max: options.braceExpandMax });
};
minimatch.braceExpand = braceExpand;
var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
var match = (list2, pattern, options = {}) => {
  const mm = new Minimatch(pattern, options);
  list2 = list2.filter((f) => mm.match(f));
  if (mm.options.nonull && !list2.length) {
    list2.push(pattern);
  }
  return list2;
};
minimatch.match = match;
var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
var regExpEscape2 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var Minimatch = class {
  options;
  set;
  pattern;
  windowsPathsNoEscape;
  nonegate;
  negate;
  comment;
  empty;
  preserveMultipleSlashes;
  partial;
  globSet;
  globParts;
  nocase;
  isWindows;
  platform;
  windowsNoMagicRoot;
  maxGlobstarRecursion;
  regexp;
  constructor(pattern, options = {}) {
    assertValidPattern(pattern);
    options = options || {};
    this.options = options;
    this.maxGlobstarRecursion = options.maxGlobstarRecursion ?? 200;
    this.pattern = pattern;
    this.platform = options.platform || defaultPlatform;
    this.isWindows = this.platform === "win32";
    const awe = "allowWindowsEscape";
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options[awe] === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
    this.regexp = null;
    this.negate = false;
    this.nonegate = !!options.nonegate;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.nocase = !!this.options.nocase;
    this.windowsNoMagicRoot = options.windowsNoMagicRoot !== void 0 ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
    this.globSet = [];
    this.globParts = [];
    this.set = [];
    this.make();
  }
  hasMagic() {
    if (this.options.magicalBraces && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (typeof part !== "string")
          return true;
      }
    }
    return false;
  }
  debug(..._) {
  }
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    this.globSet = [...new Set(this.braceExpand())];
    if (options.debug) {
      this.debug = (...args) => console.error(...args);
    }
    this.debug(this.pattern, this.globSet);
    const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
        const isDrive = /^[a-z]:/i.test(s[0]);
        if (isUNC) {
          return [
            ...s.slice(0, 4),
            ...s.slice(4).map((ss) => this.parse(ss))
          ];
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
        }
      }
      return s.map((ss) => this.parse(ss));
    });
    this.debug(this.pattern, set);
    this.set = set.filter((s) => s.indexOf(false) === -1);
    if (this.isWindows) {
      for (let i = 0; i < this.set.length; i++) {
        const p = this.set[i];
        if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
          p[2] = "?";
        }
      }
    }
    this.debug(this.pattern, this.set);
  }
  // various transforms to equivalent pattern sets that are
  // faster to process in a filesystem walk.  The goal is to
  // eliminate what we can, and push all ** patterns as far
  // to the right as possible, even if it increases the number
  // of patterns that we have to process.
  preprocess(globParts) {
    if (this.options.noglobstar) {
      for (const partset of globParts) {
        for (let j = 0; j < partset.length; j++) {
          if (partset[j] === "**") {
            partset[j] = "*";
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      globParts = this.firstPhasePreProcess(globParts);
      globParts = this.secondPhasePreProcess(globParts);
    } else if (optimizationLevel >= 1) {
      globParts = this.levelOneOptimize(globParts);
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts);
    }
    return globParts;
  }
  // just get rid of adjascent ** portions
  adjascentGlobstarOptimize(globParts) {
    return globParts.map((parts) => {
      let gs = -1;
      while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
      }
      return parts;
    });
  }
  // get rid of adjascent ** and resolve .. portions
  levelOneOptimize(globParts) {
    return globParts.map((parts) => {
      parts = parts.reduce((set, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      }, []);
      return parts.length === 0 ? [""] : parts;
    });
  }
  levelTwoFileOptimize(parts) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts);
    }
    let didSomething = false;
    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes) {
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i];
          if (i === 1 && p === "" && parts[0] === "")
            continue;
          if (p === "." || p === "") {
            didSomething = true;
            parts.splice(i, 1);
            i--;
          }
        }
        if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
          didSomething = true;
          parts.pop();
        }
      }
      let dd = 0;
      while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
        const p = parts[dd - 1];
        if (p && p !== "." && p !== ".." && p !== "**" && !(this.isWindows && /^[a-z]:$/i.test(p))) {
          didSomething = true;
          parts.splice(dd - 1, 2);
          dd -= 2;
        }
      }
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }
  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts) {
    let didSomething = false;
    do {
      didSomething = false;
      for (let parts of globParts) {
        let gs = -1;
        while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
          let gss = gs;
          while (parts[gss + 1] === "**") {
            gss++;
          }
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs);
          }
          let next = parts[gs + 1];
          const p = parts[gs + 2];
          const p2 = parts[gs + 3];
          if (next !== "..")
            continue;
          if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
            continue;
          }
          didSomething = true;
          parts.splice(gs, 1);
          const other = parts.slice(0);
          other[gs] = "**";
          globParts.push(other);
          gs--;
        }
        if (!this.preserveMultipleSlashes) {
          for (let i = 1; i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            const needDot = dd === 1 && parts[dd + 1] === "**";
            const splin = needDot ? ["."] : [];
            parts.splice(dd - 1, 2, ...splin);
            if (parts.length === 0)
              parts.push("");
            dd -= 2;
          }
        }
      }
    } while (didSomething);
    return globParts;
  }
  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts) {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
        if (matched) {
          globParts[i] = [];
          globParts[j] = matched;
          break;
        }
      }
    }
    return globParts.filter((gs) => gs.length);
  }
  partsMatch(a, b, emptyGSMatch = false) {
    let ai = 0;
    let bi = 0;
    let result = [];
    let which = "";
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === "b" ? b[bi] : a[ai]);
        ai++;
        bi++;
      } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
        result.push(a[ai]);
        ai++;
      } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
        result.push(b[bi]);
        bi++;
      } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
        if (which === "b")
          return false;
        which = "a";
        result.push(a[ai]);
        ai++;
        bi++;
      } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
        if (which === "a")
          return false;
        which = "b";
        result.push(b[bi]);
        ai++;
        bi++;
      } else {
        return false;
      }
    }
    return a.length === b.length && result;
  }
  parseNegate() {
    if (this.nonegate)
      return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset)
      this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file, pattern, partial2 = false) {
    let fileStartIndex = 0;
    let patternStartIndex = 0;
    if (this.isWindows) {
      const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
      const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
      const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
      const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
      const fdi = fileUNC ? 3 : fileDrive ? 0 : void 0;
      const pdi = patternUNC ? 3 : patternDrive ? 0 : void 0;
      if (typeof fdi === "number" && typeof pdi === "number") {
        const [fd, pd] = [
          file[fdi],
          pattern[pdi]
        ];
        if (fd.toLowerCase() === pd.toLowerCase()) {
          pattern[pdi] = fd;
          patternStartIndex = pdi;
          fileStartIndex = fdi;
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file);
    }
    if (pattern.includes(GLOBSTAR)) {
      return this.#matchGlobstar(file, pattern, partial2, fileStartIndex, patternStartIndex);
    }
    return this.#matchOne(file, pattern, partial2, fileStartIndex, patternStartIndex);
  }
  #matchGlobstar(file, pattern, partial2, fileIndex, patternIndex) {
    const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
    const lastgs = pattern.lastIndexOf(GLOBSTAR);
    const [head, body, tail] = partial2 ? [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1),
      []
    ] : [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1, lastgs),
      pattern.slice(lastgs + 1)
    ];
    if (head.length) {
      const fileHead = file.slice(fileIndex, fileIndex + head.length);
      if (!this.#matchOne(fileHead, head, partial2, 0, 0)) {
        return false;
      }
      fileIndex += head.length;
      patternIndex += head.length;
    }
    let fileTailMatch = 0;
    if (tail.length) {
      if (tail.length + fileIndex > file.length)
        return false;
      let tailStart = file.length - tail.length;
      if (this.#matchOne(file, tail, partial2, tailStart, 0)) {
        fileTailMatch = tail.length;
      } else {
        if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) {
          return false;
        }
        tailStart--;
        if (!this.#matchOne(file, tail, partial2, tailStart, 0)) {
          return false;
        }
        fileTailMatch = tail.length + 1;
      }
    }
    if (!body.length) {
      let sawSome = !!fileTailMatch;
      for (let i2 = fileIndex; i2 < file.length - fileTailMatch; i2++) {
        const f = String(file[i2]);
        sawSome = true;
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return partial2 || sawSome;
    }
    const bodySegments = [[[], 0]];
    let currentBody = bodySegments[0];
    let nonGsParts = 0;
    const nonGsPartsSums = [0];
    for (const b of body) {
      if (b === GLOBSTAR) {
        nonGsPartsSums.push(nonGsParts);
        currentBody = [[], 0];
        bodySegments.push(currentBody);
      } else {
        currentBody[0].push(b);
        nonGsParts++;
      }
    }
    let i = bodySegments.length - 1;
    const fileLength = file.length - fileTailMatch;
    for (const b of bodySegments) {
      b[1] = fileLength - (nonGsPartsSums[i--] + b[0].length);
    }
    return !!this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial2, 0, !!fileTailMatch);
  }
  // return false for "nope, not matching"
  // return null for "not matching, cannot keep trying"
  #matchGlobStarBodySections(file, bodySegments, fileIndex, bodyIndex, partial2, globStarDepth, sawTail) {
    const bs = bodySegments[bodyIndex];
    if (!bs) {
      for (let i = fileIndex; i < file.length; i++) {
        sawTail = true;
        const f = file[i];
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return sawTail;
    }
    const [body, after2] = bs;
    while (fileIndex <= after2) {
      const m = this.#matchOne(file.slice(0, fileIndex + body.length), body, partial2, fileIndex, 0);
      if (m && globStarDepth < this.maxGlobstarRecursion) {
        const sub = this.#matchGlobStarBodySections(file, bodySegments, fileIndex + body.length, bodyIndex + 1, partial2, globStarDepth + 1, sawTail);
        if (sub !== false) {
          return sub;
        }
      }
      const f = file[fileIndex];
      if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
        return false;
      }
      fileIndex++;
    }
    return partial2 || null;
  }
  #matchOne(file, pattern, partial2, fileIndex, patternIndex) {
    let fi;
    let pi;
    let pl;
    let fl;
    for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      let p = pattern[pi];
      let f = file[fi];
      this.debug(pattern, p, f);
      if (p === false || p === GLOBSTAR) {
        return false;
      }
      let hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = p.test(f);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit)
        return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial2;
    } else if (pi === pl) {
      return fi === fl - 1 && file[fi] === "";
    } else {
      throw new Error("wtf?");
    }
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**")
      return GLOBSTAR;
    if (pattern === "")
      return "";
    let m;
    let fastTest = null;
    if (m = pattern.match(starRE)) {
      fastTest = options.dot ? starTestDot : starTest;
    } else if (m = pattern.match(starDotExtRE)) {
      fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
    } else if (m = pattern.match(qmarksRE)) {
      fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
    } else if (m = pattern.match(starDotStarRE)) {
      fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
    } else if (m = pattern.match(dotStarRE)) {
      fastTest = dotStarTest;
    }
    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest && typeof re === "object") {
      Reflect.defineProperty(re, "test", { value: fastTest });
    }
    return re;
  }
  makeRe() {
    if (this.regexp || this.regexp === false)
      return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star2 : options.dot ? twoStarDot : twoStarNoDot;
    const flags = new Set(options.nocase ? ["i"] : []);
    let re = set.map((pattern) => {
      const pp = pattern.map((p) => {
        if (p instanceof RegExp) {
          for (const f of p.flags.split(""))
            flags.add(f);
        }
        return typeof p === "string" ? regExpEscape2(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
      });
      pp.forEach((p, i) => {
        const next = pp[i + 1];
        const prev = pp[i - 1];
        if (p !== GLOBSTAR || prev === GLOBSTAR) {
          return;
        }
        if (prev === void 0) {
          if (next !== void 0 && next !== GLOBSTAR) {
            pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
          } else {
            pp[i] = twoStar;
          }
        } else if (next === void 0) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + ")?";
        } else if (next !== GLOBSTAR) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
          pp[i + 1] = GLOBSTAR;
        }
      });
      const filtered = pp.filter((p) => p !== GLOBSTAR);
      if (this.partial && filtered.length >= 1) {
        const prefixes = [];
        for (let i = 1; i <= filtered.length; i++) {
          prefixes.push(filtered.slice(0, i).join("/"));
        }
        return "(?:" + prefixes.join("|") + ")";
      }
      return filtered.join("/");
    }).join("|");
    const [open2, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
    re = "^" + open2 + re + close + "$";
    if (this.partial) {
      re = "^(?:\\/|" + open2 + re.slice(1, -1) + close + ")$";
    }
    if (this.negate)
      re = "^(?!" + re + ").+$";
    try {
      this.regexp = new RegExp(re, [...flags].join(""));
    } catch {
      this.regexp = false;
    }
    return this.regexp;
  }
  slashSplit(p) {
    if (this.preserveMultipleSlashes) {
      return p.split("/");
    } else if (this.isWindows && /^\/\/[^/]+/.test(p)) {
      return ["", ...p.split(/\/+/)];
    } else {
      return p.split(/\/+/);
    }
  }
  match(f, partial2 = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) {
      return false;
    }
    if (this.empty) {
      return f === "";
    }
    if (f === "/" && partial2) {
      return true;
    }
    const options = this.options;
    if (this.isWindows) {
      f = f.split("\\").join("/");
    }
    const ff = this.slashSplit(f);
    this.debug(this.pattern, "split", ff);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename = ff[ff.length - 1];
    if (!filename) {
      for (let i = ff.length - 2; !filename && i >= 0; i--) {
        filename = ff[i];
      }
    }
    for (const pattern of set) {
      let file = ff;
      if (options.matchBase && pattern.length === 1) {
        file = [filename];
      }
      const hit = this.matchOne(file, pattern, partial2);
      if (hit) {
        if (options.flipNegate) {
          return true;
        }
        return !this.negate;
      }
    }
    if (options.flipNegate) {
      return false;
    }
    return this.negate;
  }
  static defaults(def) {
    return minimatch.defaults(def).Minimatch;
  }
};
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;

// src/analysis/changed-file.ts
var pullRequestFileLimit = 3e3;
function changedLines(file) {
  return file.additions + file.deletions;
}

// src/analysis/finding.ts
function countBySeverity(findings, severity) {
  return findings.filter((finding2) => finding2.severity === severity).length;
}

// node_modules/zod/v4/core/util.js
var util_exports = {};
__export(util_exports, {
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES,
  CONSTANT_CATCH: () => CONSTANT_CATCH,
  Class: () => Class,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  aborted: () => aborted,
  allowsEval: () => allowsEval,
  assert: () => assert,
  assertEqual: () => assertEqual,
  assertIs: () => assertIs,
  assertNever: () => assertNever,
  assertNotEqual: () => assertNotEqual,
  assignProp: () => assignProp,
  attachSchema: () => attachSchema,
  base64ToUint8Array: () => base64ToUint8Array,
  base64urlToUint8Array: () => base64urlToUint8Array,
  cached: () => cached,
  captureStackTrace: () => captureStackTrace,
  cleanEnum: () => cleanEnum,
  cleanRegex: () => cleanRegex,
  clone: () => clone,
  cloneDef: () => cloneDef,
  codePointLength: () => codePointLength,
  constantCatch: () => constantCatch,
  createTransparentProxy: () => createTransparentProxy,
  defineLazy: () => defineLazy,
  defineLazyInternal: () => defineLazyInternal,
  derived: () => derived,
  esc: () => esc,
  escapeRegex: () => escapeRegex,
  explicitlyAborted: () => explicitlyAborted,
  extend: () => extend,
  finalizeIssue: () => finalizeIssue,
  floatSafeRemainder: () => floatSafeRemainder,
  getElementAtPath: () => getElementAtPath,
  getEnumValues: () => getEnumValues,
  getLengthableOrigin: () => getLengthableOrigin,
  getParsedType: () => getParsedType,
  getSizableOrigin: () => getSizableOrigin,
  hexToUint8Array: () => hexToUint8Array,
  hide: () => hide,
  installLazyProp: () => installLazyProp,
  isObject: () => isObject,
  isPlainObject: () => isPlainObject,
  issue: () => issue,
  joinValues: () => joinValues,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  members: () => members,
  merge: () => merge,
  mergeDefs: () => mergeDefs,
  normalizeParams: () => normalizeParams,
  nullish: () => nullish,
  numKeys: () => numKeys,
  objectClone: () => objectClone,
  omit: () => omit,
  optionalKeys: () => optionalKeys,
  own: () => own,
  parsedType: () => parsedType,
  partial: () => partial,
  pick: () => pick,
  prefixIssues: () => prefixIssues,
  primitiveTypes: () => primitiveTypes,
  promiseAllObject: () => promiseAllObject,
  propertyKeyTypes: () => propertyKeyTypes,
  randomString: () => randomString,
  rawShape: () => rawShape,
  required: () => required,
  safeExtend: () => safeExtend,
  shallowClone: () => shallowClone,
  sizeCaps: () => sizeCaps,
  slugify: () => slugify,
  stringifyPrimitive: () => stringifyPrimitive,
  toZod: () => toZod,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToHex: () => uint8ArrayToHex,
  unwrapMessage: () => unwrapMessage
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function toZod() {
  return (schema) => schema;
}
function assertIs(_arg) {
}
function assertNever(_x) {
  throw new Error("Unexpected value in exhaustive check");
}
function assert(_) {
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array2, separator = "|") {
  return array2.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
var Cached = class {
  constructor(getter) {
    this._getter = getter;
    this._value = void 0;
  }
  get value() {
    const getter = this._getter;
    if (getter !== void 0) {
      this._value = getter();
      this._getter = void 0;
    }
    return this._value;
  }
};
function cached(getter) {
  return new Cached(getter);
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function rawShape(def) {
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
  return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
  Object.defineProperty(target, key, {
    get() {
      const value = getter();
      assignProp(this, key, value);
      return value;
    },
    enumerable: true,
    configurable: true
  });
}
function putProp(target, key, value) {
  if (key in target)
    assignProp(target, key, value);
  else
    target[key] = value;
}
function mirrorShape(target, source, keys, wrap) {
  const raw = sourceShape(source);
  for (const key of keys) {
    const desc = Object.getOwnPropertyDescriptor(raw, key);
    if (!desc.enumerable)
      continue;
    if (desc.get) {
      deferProp(target, key, () => {
        const value = source._zod.def.shape[key];
        return wrap ? wrap(value, key) : value;
      });
    } else
      putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
  }
}
function mirrorProps(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc.enumerable)
      continue;
    if (desc.get)
      deferProp(target, key, () => source[key]);
    else
      putProp(target, key, desc.value);
  }
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path2) {
  if (!path2)
    return obj;
  return path2.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0; i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
};
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var primitiveTypes = /* @__PURE__ */ new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "symbol",
  "undefined"
]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks2 = currDef.checks;
  const hasChecks = checks2 && checks2.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const newShape = {};
  mirrorShape(newShape, schema, maskedKeys(schema, mask));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function maskedKeys(schema, mask) {
  const raw = sourceShape(schema);
  const keys = [];
  for (const key of Reflect.ownKeys(mask)) {
    if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) {
      throw new Error(`Unrecognized key: "${String(key)}"`);
    }
    if (mask[key])
      keys.push(key);
  }
  return keys;
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks2 = currDef.checks;
  const hasChecks = checks2 && checks2.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const omitted = new Set(maskedKeys(schema, mask));
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks2 = schema._zod.def.checks;
  const hasChecks = checks2 && checks2.length > 0;
  if (hasChecks) {
    const existingShape = sourceShape(schema);
    for (const key of Reflect.ownKeys(shape)) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
  mirrorProps(newShape, shape);
  return newShape;
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
  if (!b?._zod?.def) {
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  }
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const newShape = {};
  mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
  mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
  const def = mergeDefs(a._zod.def, {
    shape: newShape,
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class2, schema, mask, name = "partial") {
  const currDef = schema._zod.def;
  const checks2 = currDef.checks;
  const hasChecks = checks2 && checks2.length > 0;
  if (hasChecks) {
    throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
  }
  const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class2 && ((value, key) => selected && !selected.has(key) ? value : new Class2({ type: "optional", innerType: value })));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape, checks: [] }));
}
function required(Class2, schema, mask) {
  const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => (
    // overwrite with non-optional
    selected && !selected.has(key) ? value : new Class2({ type: "nonoptional", innerType: value })
  ));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path2, issues) {
  return issues.map((iss) => {
    var _a4;
    (_a4 = iss).path ?? (_a4.path = []);
    iss.path.unshift(path2);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function sizeCaps(defChecks) {
  const caps = [];
  for (const ch of defChecks ?? []) {
    const d = ch._zod.def;
    if (!/_(length|size)$|_equals$/.test(d.check))
      break;
    const max = d.maximum ?? d.length ?? d.size;
    if (max >= 0)
      caps.push([max, ch]);
  }
  return caps;
}
function attachSchema(issues, start, inst) {
  var _a4;
  for (let i = start; i < issues.length; i++) {
    (_a4 = issues[i]).schema ?? (_a4.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config2) {
  var _a4;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a4 = iss).schema ?? (_a4.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const full = {};
  for (const k of Object.keys(iss)) {
    if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
      continue;
    full[k] = iss[k];
  }
  full.path ?? (full.path = []);
  full.message = message;
  if (ctx?.reportInput) {
    full.input = iss.input;
  }
  return full;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0; i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base642) {
  const binaryString = atob(base642);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url2) {
  const base642 = base64url2.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base642.length % 4) % 4);
  return base64ToUint8Array(base642 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var Class = class {
  constructor(..._args) {
  }
};
function members(proto, table) {
  for (const key in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key);
    if (desc.get)
      Object.defineProperty(proto, key, { ...desc, enumerable: false });
    else
      defineBound(proto, key, desc.value);
  }
}
function own(inst, key, value, enumerable = true) {
  Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
  return value;
}
function hide(inst, key, value) {
  return own(inst, key, value, false);
}
// @__NO_SIDE_EFFECTS__
function derived(computes, table) {
  for (const key in computes) {
    const compute = computes[key];
    Object.defineProperty(table, key, {
      configurable: true,
      enumerable: true,
      get() {
        return own(this, key, compute(this));
      },
      set(value) {
        own(this, key, value);
      }
    });
  }
  return table;
}
function defineBound(proto, key, fn) {
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key, fn.bind(this));
    },
    set(value) {
      own(this, key, value);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
  configurable: true,
  get() {
    broke = true;
    return void 0;
  }
};
function defineLazyInternal(inst, key, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key in proto && installing !== inst._zod) {
    installing = void 0;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      Object.defineProperty(this, key, breaker);
      const outer = broke;
      broke = false;
      try {
        const value = compute(this);
        if (broke)
          delete this[key];
        else
          Object.defineProperty(this, key, { configurable: true, writable: true, value });
        broke = broke || outer;
        return value;
      } catch (err) {
        delete this[key];
        broke = broke || outer;
        throw err;
      }
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, value });
    }
  });
}
function installLazyProp(inst, key, make, enumerable) {
  const proto = claim(inst, key);
  if (!proto)
    return;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: void 0 };
      Object.defineProperty(this, key, desc);
      desc.value = make(this);
      Object.defineProperty(this, key, desc);
      return desc.value;
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
    }
  });
}
var CONSTANT_CATCH = "~constantCatch";
function constantCatch(value) {
  const fn = () => value;
  fn[CONSTANT_CATCH] = true;
  return fn;
}

// node_modules/zod/v4/core/core.js
var _a2;
var _zodDesc = { value: void 0, enumerable: false };
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition();
      }
      try {
        return new Definition();
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition();
}
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer3, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = /* @__PURE__ */ new Set();
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
  function init2(inst, def) {
    if (!inst._zod) {
      _zodDesc.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc);
      } finally {
        _zodDesc.value = void 0;
      }
    } else if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer3(inst, def);
    if (initialized) {
      const own2 = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own2;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own2;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto2 = _.prototype;
    for (const k in proto2) {
      if (!Object.prototype.hasOwnProperty.call(proto2, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto2[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init2(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = void 0;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init2 });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
var $ZodEncodeError = class extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
};
(_a2 = globalThis).__zod_globalConfig ?? (_a2.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// node_modules/zod/v4/core/errors.js
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value) {
  this._zod.message = value;
}
var _messageDesc = {
  get: _getMessage,
  set: _setMessage,
  enumerable: true,
  configurable: true
};
var _issuesDesc = { value: void 0, enumerable: false };
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _issuesDesc.value = void 0;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value = () => this.message;
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
      }
    });
  }
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, void 0, {
  Parent: Error
});
function node(obj, key, make) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    if (key === "__proto__") {
      Object.defineProperty(obj, key, { value: make(), writable: true, enumerable: true, configurable: true });
    } else {
      obj[key] = make();
    }
  }
  return obj[key];
}
function flattenError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error2.issues) {
    if (sub.path.length > 0) {
      node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error3, path2 = []) => {
    for (const issue2 of error3.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path2, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path2, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path2, ...issue2.path]);
      } else {
        const fullpath = [...path2, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (el === "_errors") {
              if (terminal)
                curr._errors.push(mapper(issue2));
              i++;
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(curr, el)) {
              Object.defineProperty(curr, el, {
                value: { _errors: [] },
                enumerable: true,
                writable: true,
                configurable: true
              });
            }
            const node2 = curr[el];
            if (terminal) {
              node2._errors.push(mapper(issue2));
            }
            curr = node2;
            i++;
          }
        }
      }
    }
  };
  processError(error2);
  return fieldErrors;
}

// node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
  return { callee: params?.callee ?? callee, Err: params?.Err };
}
var _parse = (_Err) => {
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _parseAsync = (_Err) => {
  const fn = async (schema, value, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
function failure(Err, issues, ctx) {
  let error2;
  return {
    success: false,
    get error() {
      if (!error2) {
        error2 = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
        issues = void 0;
        ctx = void 0;
      }
      return error2;
    },
    set error(e) {
      error2 = e;
      issues = void 0;
      ctx = void 0;
    }
  };
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate = ((schema, value, _ctx) => {
  const validator = schema._zod.bag.validator;
  if (validator !== void 0) {
    if (validator(value) !== COMPILE_INVALID)
      return true;
    if (validator.definite === true && _ctx === void 0)
      return false;
  }
  return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
  const ctx = _ctx ? { ..._ctx, async: false, abortEarly: true } : { async: false, abortEarly: true };
  const fallbackRun = schema._zod.bag.fallbackRun;
  let result;
  if (fallbackRun) {
    ctx[COMPILE_FALLBACK] = true;
    result = fallbackRun({ value, issues: [] }, ctx);
  } else {
    result = schema._zod.run({ value, issues: [] }, ctx);
  }
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length === 0;
}
var validateAsync = async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true, abortEarly: true } : { async: true, abortEarly: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length === 0;
};
var _encode = (_Err) => {
  const parse4 = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return parse4(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decode = (_Err) => {
  const parse4 = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    return parse4(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _encodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return await parseAsync2(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    return await parseAsync2(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};

// node_modules/zod/v4/core/regexes.js
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
  return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var uuid = (version3) => {
  if (!version3)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version3}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
  return new RegExp(_emoji, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
function anchor(source) {
  return new RegExp(`^${source}$`);
}
var date = /* @__PURE__ */ anchor(dateSource);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const opts = ["Z"];
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
  const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?$/;
var boolean = /^(?:true|false)$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a4;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a4 = inst._zod).onattach ?? (_a4.onattach = []);
});
var _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? (
      // `value % 0n` throws, and nothing is a multiple of zero — the number branch already fails this way via NaN
      def.value !== BigInt(0) && payload.value % def.value === BigInt(0)
    ) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum2, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum2) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum: minimum2,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a4;
  $ZodCheck.init(inst, def);
  (_a4 = inst._zod.def).when ?? (_a4.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a4;
  $ZodCheck.init(inst, def);
  (_a4 = inst._zod.def).when ?? (_a4.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a4;
  $ZodCheck.init(inst, def);
  (_a4 = inst._zod.def).when ?? (_a4.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a4, _b;
  $ZodCheck.init(inst, def);
  if (def.pattern)
    (_a4 = inst._zod).check ?? (_a4.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// node_modules/zod/v4/core/doc.js
var Doc = class {
  constructor(args = [], closed = {}) {
    this.content = [];
    this.indent = 0;
    this.args = args;
    this.closed = closed;
  }
  // the compiler catches a child's throw and keeps writing into this doc, so the indent has to unwind with it
  indented(fn) {
    this.indent += 1;
    try {
      fn(this);
    } finally {
      this.indent -= 1;
    }
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const content = this?.content ?? [``];
    const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join("\n")}
};`);
    return factory(...Object.values(this.closed));
  }
};

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 6,
  patch: 7
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a4;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const defChecks = inst._zod.def.checks;
  const checks2 = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
  for (const ch of checks2) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks2.length === 0) {
    (_a4 = inst._zod).deferred ?? (_a4.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks3, ctx) => {
      if (payload.memo)
        return payload;
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks3) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          attachSchema(payload.issues, currLen, inst);
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks2, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks2, ctx));
      }
      return runChecks(result, checks2, ctx);
    };
  }
}, {
  // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
  get "~standard"() {
    return hide(this, "~standard", standardProps(this));
  },
  set "~standard"(value) {
    own(this, "~standard", value);
  }
});
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync2(inst, value) {
  const ctx = { async: true };
  return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
}
function standardProps(inst) {
  return {
    validate: (value) => {
      const ctx = { async: false };
      try {
        const r = inst._zod.run({ value, issues: [] }, ctx);
        if (!(r instanceof Promise))
          return toStandardResult(r, ctx);
      } catch (_) {
      }
      return validateAsync2(inst, value);
    },
    vendor: "zod",
    version: 1
  };
}
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = def.pattern ?? anyString;
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
var URL_BAD_FORMAT = 1;
var URL_UNPARSEABLE = 2;
function canParseURL(input) {
  try {
    if (typeof URL !== "undefined" && typeof URL.canParse === "function")
      return URL.canParse(input);
    new URL(input);
    return true;
  } catch {
    return false;
  }
}
function validateURL(trimmed, def) {
  if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) {
    return canParseURL(trimmed) || URL_UNPARSEABLE;
  }
  return parseURLObject(trimmed, def);
}
function parseURLObject(trimmed, def) {
  if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
    return URL_BAD_FORMAT;
  }
  try {
    if (typeof URL !== "undefined") {
      const URLStatic = URL;
      if (typeof URLStatic.parse === "function")
        return URLStatic.parse(trimmed) ?? URL_UNPARSEABLE;
    }
    return new URL(trimmed);
  } catch {
    return URL_UNPARSEABLE;
  }
}
var asciiTabOrNewline = /[\t\n\r]/g;
function stripTabAndNewline(value) {
  return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
  hostname.lastIndex = 0;
  return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
  protocol.lastIndex = 0;
  return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url = validateURL(trimmed, def);
      if (url === URL_BAD_FORMAT) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === URL_UNPARSEABLE) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === true) {
        payload.value = stripTabAndNewline(trimmed);
        return;
      }
      if (def.hostname && !urlHostnameOk(url, def.hostname)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid hostname",
          pattern: def.hostname.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      if (def.protocol && !urlProtocolOk(url, def.protocol)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid protocol",
          pattern: def.protocol.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1))
    throw new Error(`Invalid nanoid length: ${def.length}`);
  def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
});
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
  if (!ipv6Alphabet.test(value))
    return false;
  return canParseURL(`http://[${value}]`);
}
var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidIPv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
  const parts = value.split("/");
  if (parts.length !== 2)
    return false;
  const [address, prefix] = parts;
  if (!prefix)
    return false;
  const prefixNum = Number(prefix);
  if (`${prefixNum}` !== prefix)
    return false;
  if (prefixNum < 0 || prefixNum > 128)
    return false;
  return isValidIPv6(address);
}
var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidCIDRv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64Charset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
  if (!base64urlCharset.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64urlCharset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token2, algorithm = null) {
  try {
    const tokensParts = token2.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header2] = tokensParts;
    if (!header2)
      return false;
    const parsedHeader = JSON.parse(atob(header2));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function capSize(inst, size) {
  const caps = sizeCaps(inst._zod.def.checks);
  if (!caps.length)
    return;
  const cap = Math.min(...caps.map((c) => c[0]));
  const parse4 = inst._zod.parse;
  inst._zod.parse = (payload, ctx) => {
    const n = size(payload.value);
    if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
      for (const [max, ch] of sizeCaps(inst._zod.def.checks)) {
        if (n > max && ch._zod.def.when(payload)) {
          const start = payload.issues.length;
          ch._zod.check(payload);
          payload.issues[start].continue = false;
          attachSchema(payload.issues, start, inst);
          return payload;
        }
      }
    }
    return parse4(payload, ctx);
  };
}
var arraySize = (input) => Array.isArray(input) ? input.length : -1;
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
    const proms = [];
    const abortEarly = ctx?.abortEarly;
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
        if (abortEarly && result.issues.length !== 0 && aborted(result))
          break;
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
  capSize(inst, arraySize);
});
function handlePropertyResult(result, final, key, input, optin, optout) {
  const isPresent = key in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== void 0 && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && optin === void 0) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent || optin === "defaulted" && !isOptionalOut) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  let seen = 0;
  for (const key in input) {
    if (abortEarly && payload.issues.length !== seen) {
      if (aborted(payload, seen))
        break;
      seen = payload.issues.length;
    }
    if (keySet.has(key))
      continue;
    if (key === "__proto__") {
      if (t === "never")
        unrecognized.push(key);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  const sh = desc?.get ? desc.get.raw : def.shape ?? {};
  if (sh) {
    const get = () => {
      const newSh = { ...sh };
      Object.defineProperty(def, "shape", { value: newSh });
      get.raw = newSh;
      return newSh;
    };
    get.raw = sh;
    Object.defineProperty(def, "shape", { get });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazyInternal(inst, "propValues", (zod) => {
    const shape = zod.def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
          assignProp(propValues, key, /* @__PURE__ */ new Set());
        }
        for (const v of field.values)
          propValues[key].add(v);
        if (field.optin !== void 0)
          propValues[key].add(void 0);
      }
    }
    return propValues;
  });
  const isObject3 = isObject;
  const catchall = def.catchall;
  let value;
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject3(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
    const proms = [];
    const shape = value.shape;
    const abortEarly = ctx?.abortEarly;
    let seen = payload.issues.length;
    for (const key of value.allKeys) {
      if (abortEarly && payload.issues.length !== seen) {
        if (aborted(payload, seen))
          break;
        seen = payload.issues.length;
      }
      if (key === "__proto__")
        continue;
      const el = shape[key];
      const optin = el._zod.optin;
      const optout = el._zod.optout;
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key, input, optin, optout);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
  };
});
var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const memo2 = globalConfig.memoizer;
  const generateFastpass = (shape) => {
    const normalized = _normalized.value;
    const syms = normalized.symbolKeys;
    const doc = new Doc(["payload", "ctx"], { shape, inst, memo: memo2, syms });
    const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized.allKeys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(memo2 ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
    for (const key of normalized.allKeys) {
      if (key === "__proto__")
        continue;
      const id = ids[key];
      const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
      const isPresent = `${k} in input`;
      const schema = shape[key];
      const optin = schema?._zod?.optin;
      const isOptionalIn = optin !== void 0;
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(k)};`);
      if (isOptionalIn && isOptionalOut) {
        const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
        doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
        if (optin === "defaulted") {
          doc.write(`newResult[${k}] = ${id}.value;`);
        } else {
          doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
        }
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    return doc.compile();
  };
  let fastpass;
  const isObject3 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval2 = allowsEval;
  const fastEnabled = jit && allowsEval2.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject3(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
  defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazyInternal(inst, "values", (zod) => {
    if (zod.def.options.every((o) => o._zod.values)) {
      return new Set(zod.def.options.flatMap((option2) => Array.from(option2._zod.values)));
    }
    return void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    if (zod.def.options.every((o) => o._zod.pattern)) {
      const patterns3 = zod.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns3.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option2 of def.options) {
      const result = option2._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
      delete newObj.__proto__;
    for (const key of sharedKeys) {
      if (key === "__proto__")
        continue;
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  const keyIssues = /* @__PURE__ */ new Map();
  const collect = (iss, side) => {
    let keys;
    if (iss.code === "unrecognized_keys" && !iss.path?.length) {
      unrecIssue ?? (unrecIssue = iss);
      keys = iss.keys;
    } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
      const k = String(iss.path[0]);
      if (!keyIssues.has(k))
        keyIssues.set(k, iss);
      keys = [k];
    } else {
      return false;
    }
    for (const k of keys) {
      if (!unrecKeys.has(k))
        unrecKeys.set(k, {});
      unrecKeys.get(k)[side] = true;
    }
    return true;
  };
  for (const iss of left.issues) {
    if (!collect(iss, "l"))
      result.issues.push(iss);
  }
  for (const iss of right.issues) {
    if (!collect(iss, "r"))
      result.issues.push(iss);
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length) {
    const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
    if (aggregated.length)
      result.issues.push({ ...unrecIssue, keys: aggregated });
    for (const k of bothKeys) {
      if (!aggregated.includes(k) && keyIssues.has(k))
        result.issues.push(keyIssues.get(k));
    }
  }
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    if (aborted(result))
      return result;
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values && !def.partial) {
      payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          if (key === "__proto__")
            continue;
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          if (outKey === "__proto__")
            continue;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          if (def.mode === "loose") {
            if (key === "__proto__")
              continue;
            payload.value[key] = input[key];
          } else {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          }
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized,
          continue: true
        });
      }
    } else {
      payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
      let unrecognized;
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else if (values) {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const outKey = keyResult.value;
        if (outKey === "__proto__")
          continue;
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[outKey] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[outKey] = result.value;
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized,
          continue: true
        });
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  defineLazyInternal(inst, "pattern", (zod) => {
    const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
    return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  globalConfig.memoizer?.guard(inst);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(payload, result) {
  payload.value = result.issues.length ? void 0 : result.value;
  return payload;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  inst._zod.optout = "optional";
  defineLazyInternal(inst, "values", (zod) => {
    const values = zod.def.innerType._zod.values;
    return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === void 0) {
      if (def.innerType._zod.optin !== "defaulted")
        return payload;
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise)
        return result.then((result2) => handleOptionalResult(payload, result2));
      return handleOptionalResult(payload, result);
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazyInternal(inst, "values", (zod) => {
    return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => {
    const v = zod.def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handleCatchResult(payload, result, def, ctx) {
  if (!result.issues.length) {
    payload.value = result.value;
    if (result.memo)
      payload.memo = true;
    return payload;
  }
  payload.value = def.catchValue({
    ...result,
    value: payload.value,
    error: {
      issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
    },
    input: payload.value
  });
  return payload;
}
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleCatchResult(payload, result2, def, ctx));
    }
    return handleCatchResult(payload, result, def, ctx);
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
  constructor() {
    super(`Cannot parse a reference cycle that closes through a transform`);
    this.name = "ZodCyclicError";
  }
};
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
  return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
  return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
}
var recursive = /* @__PURE__ */ new WeakMap();
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
function isRecursive(inst, stack, resolve2) {
  const cached2 = recursive.get(inst);
  if (cached2 !== void 0)
    return cached2 ? PROVEN : NONE;
  if (stack.has(inst))
    return PROVEN;
  stack.add(inst);
  let result = NONE;
  const check = (child) => {
    if (result !== PROVEN && child?._zod) {
      const answer = isRecursive(child, stack, resolve2);
      if (answer > result)
        result = answer;
    }
  };
  const shape = (sh, spread) => {
    let answer = NONE;
    for (const key of Reflect.ownKeys(sh)) {
      const desc = Object.getOwnPropertyDescriptor(sh, key);
      if (spread && !desc.enumerable)
        continue;
      const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve2) : NONE;
      if (child > answer)
        answer = child;
    }
    return answer;
  };
  const merge3 = (answer) => {
    if (answer > result)
      result = answer;
  };
  const def = inst._zod.def;
  const kind = def.type;
  switch (kind) {
    case "object": {
      const raw = rawShape(def);
      merge3(raw ? shape(raw, true) : ASSUMED);
      check(def.catchall);
      break;
    }
    case "array":
      check(def.element);
      break;
    case "tuple":
      for (const el of def.items)
        check(el);
      check(def.rest);
      break;
    case "record":
    case "map":
      check(def.keyType);
      check(def.valueType);
      break;
    case "set":
      check(def.valueType);
      break;
    case "union":
      for (const el of def.options)
        check(el);
      break;
    case "intersection":
      check(def.left);
      check(def.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      check(def.innerType);
      break;
    case "pipe":
      check(def.in);
      check(def.out);
      break;
    case "function":
      check(def.input);
      check(def.output);
      break;
    // `$ZodLazy` caches its inner on the def, so a resolved edge is followed exactly
    case "lazy": {
      const inner = def._cachedInner ?? (resolve2 ? inst._zod.innerType : void 0);
      merge3(inner ? isRecursive(inner, stack, false) : ASSUMED);
      break;
    }
    // a leaf by choice: `parts` are regex fragments, not data positions
    case "template_literal":
    // leaves
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default: {
      kind;
      for (const key in def) {
        const desc = Object.getOwnPropertyDescriptor(def, key);
        if (!desc || desc.get)
          continue;
        const value = desc.value;
        if (!value || typeof value !== "object")
          continue;
        if (value._zod)
          check(value);
        else if (Array.isArray(value))
          for (const el of value)
            check(el);
      }
    }
  }
  stack.delete(inst);
  return settle(inst, result);
}
function settle(inst, answer) {
  if (answer !== ASSUMED)
    recursive.set(inst, answer === PROVEN);
  return answer;
}
function bucketFor(state, inst) {
  let bucket = state.buckets.get(inst);
  if (!bucket) {
    bucket = /* @__PURE__ */ new WeakMap();
    state.buckets.set(inst, bucket);
  }
  return bucket;
}
var handoff;
var open = [];
var memo = {
  alloc(_inst, payload, empty) {
    const bucket = handoff;
    if (!bucket)
      return empty;
    handoff = void 0;
    const entry = { value: empty, issues: null };
    bucket.set(payload.value, entry);
    open.push(entry);
    return empty;
  },
  guard(inst) {
    var _a4;
    (_a4 = inst._zod).deferred ?? (_a4.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
          throw new $ZodCyclicError();
        return base(payload, ctx);
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  },
  attach(inst) {
    var _a4;
    let isRecursiveInst;
    let rechecked = false;
    let lastCtx;
    let lastBucket;
    (_a4 = inst._zod).deferred ?? (_a4.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (isRecursiveInst === void 0) {
          const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
          if (walked === NONE) {
            inst._zod.parse = base;
            if (inst._zod.run === wrapped)
              inst._zod.run = base;
            return base(payload, ctx);
          }
          if (walked === PROVEN || rechecked)
            isRecursiveInst = true;
          else
            rechecked = true;
        }
        const input = payload.value;
        if (!isRef(input))
          return base(payload, ctx);
        let state = ctx[STATE];
        if (!state) {
          state = { buckets: /* @__PURE__ */ new WeakMap(), backEdges: void 0 };
          ctx[STATE] = state;
        }
        let bucket;
        if (lastCtx === ctx) {
          bucket = lastBucket;
        } else {
          bucket = bucketFor(state, inst);
          lastCtx = ctx;
          lastBucket = bucket;
        }
        const hit = bucket.get(input);
        if (hit) {
          payload.value = hit.value;
          if (hit.issues) {
            if (hit.issues.length)
              payload.issues.push(...cloneIssues(hit.issues));
          } else {
            payload.memo = true;
            state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
            state.backEdges.add(hit.value);
          }
          return payload;
        }
        handoff = bucket;
        const depth = open.length;
        const result = base(payload, ctx);
        handoff = void 0;
        const entry = open.length > depth ? open.pop() : void 0;
        if (result instanceof Promise) {
          return result.then((r) => {
            if (entry)
              entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
            return r;
          });
        }
        if (entry)
          entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
        return result;
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  }
};
function memoizer() {
  return memo;
}
function isBackEdge(ctx, value) {
  const backEdges = ctx[STATE]?.backEdges;
  return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}

// node_modules/zod/v4/locales/en.js
var error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    currency_code: "currency code",
    credit_card: "credit card number",
    iban: "IBAN",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    // Compatibility: "nan" -> "NaN" for display
    nan: "NaN"
    // All other type names omitted - they fall back to raw values via ?? operator
  };
  function getTypeName(type, input) {
    if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
      return String(input);
    }
    return TypeDictionary[type] ?? type;
  }
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = getTypeName(issue2.expected);
        const receivedType = parsedType(issue2.input);
        const received = getTypeName(receivedType, issue2.input);
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        if (issue2.options && Array.isArray(issue2.options) && issue2.options.length > 0) {
          const opts = issue2.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        if (issue2.inclusive === false) {
          return "Invalid input: more than one option matched";
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
function en_default() {
  return {
    localeError: error()
  };
}

// node_modules/zod/v4/core/registries.js
var _a3;
var $ZodRegistry = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta2 = _meta[0];
    this._map.set(schema, meta2);
    if (meta2 && typeof meta2 === "object" && "id" in meta2) {
      this._idmap.set(meta2.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta2 = this._map.get(schema);
    if (meta2 && typeof meta2 === "object" && "id" in meta2) {
      this._idmap.delete(meta2.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
};
function registry() {
  return new $ZodRegistry();
}
(_a3 = globalThis).__zod_globalRegistry ?? (_a3.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;

// node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
  if (def.checks)
    def.checks = [...def.checks];
  return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class2, params) {
  return new Class2(snapshotChecks({ type: "string", ...normalizeParams(params) }));
}
// @__NO_SIDE_EFFECTS__
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class2, params) {
  return new Class2(snapshotChecks({ type: "number", checks: [], ...normalizeParams(params) }));
}
// @__NO_SIDE_EFFECTS__
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum2, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum: minimum2
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}

// node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources2) {
  for (const source of sources2) {
    for (const key of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key)) {
        assignProp(target, key, source[key]);
      }
    }
  }
  return target;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {
    }),
    io: params?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    sharedDefsExtractedFor: void 0,
    sharedEmitDoneFor: void 0,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: params?.external ?? void 0
  };
}
function handleUnrepresentable(schema, ctx, json, params, message) {
  const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
  if (result === "any")
    return false;
  if (result === void 0 || result === "throw")
    throw new Error(message);
  Object.assign(json, result);
  return true;
}
function processSchema(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a4;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  ctx.sharedDefsExtractedFor = void 0;
  ctx.sharedEmitDoneFor = void 0;
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      processSchema(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta2 = ctx.metadataRegistry.get(schema);
  if (meta2)
    assignProps(result.schema, meta2);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a4 = result.schema).default ?? (_a4.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function encodeJSONPointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
    return;
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    if (entry[1] === root && !entry[1].schema.id) {
      return { ref: uriPrefix };
    }
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext2 = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext2) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
      }
    }
  }
  if (ctx.external)
    ctx.sharedDefsExtractedFor = ctx.external;
}
function compactTypeUnion(schema) {
  const options = schema.anyOf;
  if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0)
    return;
  const types2 = [];
  for (const option2 of options) {
    if (!option2 || typeof option2 !== "object")
      return;
    compactTypeUnion(option2);
    const keys = Object.keys(option2);
    if (keys.length !== 1 || keys[0] !== "type")
      return;
    const type = option2.type;
    for (const member2 of Array.isArray(type) ? type : [type]) {
      if (typeof member2 !== "string")
        return;
      if (!types2.includes(member2))
        types2.push(member2);
    }
  }
  delete schema.anyOf;
  schema.type = types2.length === 1 ? types2[0] : types2;
}
var FOLDABLE_KEYS = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties"]);
var UNION_KEYS = ["oneOf", "anyOf"];
function undeclaredConstraint(member2) {
  const extra = member2.additionalProperties;
  if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null)
    return null;
  return Object.keys(extra).length ? extra : null;
}
function foldObjects(members2) {
  const objects = [];
  for (const member2 of members2) {
    if (typeof member2 !== "object" || member2.type !== "object")
      return null;
    for (const key in member2) {
      if (!FOLDABLE_KEYS.has(key))
        return null;
    }
    objects.push(member2);
  }
  const properties = {};
  const required2 = /* @__PURE__ */ new Set();
  for (const object2 of objects) {
    for (const key in object2.properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key))
        continue;
      const parts = [];
      for (const other of objects) {
        const part = other.properties?.[key] ?? undeclaredConstraint(other);
        if (part === null || part === void 0)
          continue;
        if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
          parts.push(part);
      }
      const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
      assignProp(properties, key, merged);
    }
    for (const key of object2.required ?? [])
      required2.add(key);
  }
  const folded = { type: "object", properties };
  if (required2.size)
    folded.required = [...required2];
  if (objects.every((object2) => object2.additionalProperties === false)) {
    folded.additionalProperties = false;
  } else {
    const constraints = [];
    for (const object2 of objects) {
      const constraint = undeclaredConstraint(object2);
      if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
        constraints.push(constraint);
    }
    if (constraints.length === 1)
      folded.additionalProperties = constraints[0];
    else if (constraints.length > 1)
      folded.additionalProperties = { allOf: constraints };
  }
  return folded;
}
function foldIntersection(json) {
  const allOf = json.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2)
    return;
  for (const key of FOLDABLE_KEYS)
    if (key in json)
      return;
  const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
  let folded = null;
  if (!unions.length) {
    folded = foldObjects(allOf);
  } else {
    const union2 = unions[0];
    const keyword = UNION_KEYS.find((k) => Array.isArray(union2[k]));
    if (Object.keys(union2).length !== 1)
      return;
    const rest = allOf.filter((m) => m !== union2);
    const branches = union2[keyword].map((branch) => foldObjects([...rest, branch]));
    if (branches.some((b) => !b))
      return;
    folded = { [keyword]: branches };
  }
  if (!folded)
    return;
  delete json.allOf;
  assignProps(json, folded);
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        assignProps(schema2, refSchema);
      }
      assignProps(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of [...ctx.seen.entries()].reverse()) {
      flattenRef(entry[0]);
    }
    if (ctx.target !== "openapi-3.0") {
      for (const entry of ctx.seen.entries()) {
        compactTypeUnion(entry[1].def ?? entry[1].schema);
      }
    }
    for (const rewrite of ctx.deferred)
      rewrite();
    if (ctx.intersections.length) {
      const carriers = /* @__PURE__ */ new Map();
      for (const seen of ctx.seen.values()) {
        for (const json of [seen.schema, seen.def]) {
          const allOf = json?.allOf;
          if (!Array.isArray(allOf))
            continue;
          const existing = carriers.get(allOf);
          if (existing)
            existing.push(json);
          else
            carriers.set(allOf, [json]);
        }
      }
      for (const allOf of ctx.intersections) {
        for (const json of carriers.get(allOf) ?? [])
          foldIntersection(json);
      }
    }
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {
  } else {
  }
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        if (seen.def.id === seen.defId)
          delete seen.def.id;
        assignProp(defs, seen.defId, seen.def);
      }
    }
  }
  if (ctx.external)
    ctx.sharedEmitDoneFor = ctx.external;
  if (ctx.external) {
  } else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option2 of def.options) {
      if (isTransforming(option2, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};

// node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
  if (agg[key] === void 0 || value > agg[key])
    agg[key] = value;
};
var narrowMax = (agg, key, value) => {
  if (agg[key] === void 0 || value < agg[key])
    agg[key] = value;
};
var narrowBoth = (agg, value) => {
  narrowMin(agg, "minimum", value);
  narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
  agg.multipleOf ?? (agg.multipleOf = []);
  if (!agg.multipleOf.includes(value))
    agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
  agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
  agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
  agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
  agg.format = format;
  if (format.includes("int"))
    agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
  setFormat(agg, def.format);
  const [minimum2, maximum] = ranges[def.format];
  narrowMin(agg, "minimum", minimum2);
  narrowMax(agg, "maximum", maximum);
};
var contributors = {
  greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
  less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
  multiple_of: (agg, def) => addDivisor(agg, def.value),
  number_format: formatContributor(NUMBER_FORMAT_RANGES),
  bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
  min_length: minContributor,
  max_length: maxContributor,
  length_equals: (agg, def) => narrowBoth(agg, def.length),
  min_size: minContributor,
  max_size: maxContributor,
  size_equals: (agg, def) => narrowBoth(agg, def.size),
  string_format: (agg, def) => {
    setFormat(agg, def.format);
    if (def.pattern)
      addPattern(agg, def.pattern);
    if (def.format === "base64" || def.format === "base64url")
      agg.contentEncoding = def.format;
    if (def.local || def.precision === -1)
      agg.laxFormat = true;
  },
  mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
  const agg = {};
  const def = schema._zod.def;
  const list2 = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
  for (const ch of list2)
    contributors[ch._zod.def.check]?.(agg, ch._zod.def);
  const bag = schema._zod.bag;
  if (bag.minimum !== void 0)
    narrowMin(agg, "minimum", bag.minimum);
  if (bag.exclusiveMinimum !== void 0)
    narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
  if (bag.maximum !== void 0)
    narrowMax(agg, "maximum", bag.maximum);
  if (bag.exclusiveMaximum !== void 0)
    narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
  if (bag.multipleOf !== void 0)
    addDivisor(agg, bag.multipleOf);
  if (bag.format !== void 0) {
    agg.format ?? (agg.format = bag.format);
    if (bag.format.includes("int"))
      agg.isInt = true;
  }
  if (bag.mime)
    intersectMime(agg, bag.mime);
  for (const pattern of bag.patterns ?? [])
    addPattern(agg, pattern);
  return agg;
}
var formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
var exactPatterns = /* @__PURE__ */ new Map([
  [base64Charset, base64],
  [base64urlCharset, base64url]
]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum: minimum2, maximum, format, patterns: patterns3, contentEncoding, laxFormat } = aggregateChecks(schema);
  if (typeof minimum2 === "number")
    json.minLength = minimum2;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time" || laxFormat) {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns3 && patterns3.size > 0) {
    const patternList = [...patterns3].map(exactPattern);
    if (patternList.length === 1)
      json.pattern = patternList[0].source;
    else if (patternList.length > 1) {
      json.allOf = [
        ...patternList.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
var numberProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const { minimum: minimum2, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
  json.type = isInt ? "integer" : "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum2 ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum2 === "number") {
    json.minimum = minimum2;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (multipleOf) {
    const divisors = /* @__PURE__ */ new Set();
    for (const divisor of multipleOf) {
      if (Number.isFinite(divisor) && divisor !== 0)
        divisors.add(Math.abs(divisor));
      else
        handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
    }
    const [first, ...rest] = divisors;
    if (first !== void 0)
      json.multipleOf = first;
    if (rest.length)
      json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
  }
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
var neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
var unknownProcessor = (_schema, _ctx, _json, _params) => {
};
var enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.length === 0) {
    json.not = {};
    return;
  }
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
var customProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum: minimum2, maximum } = aggregateChecks(schema);
  if (typeof minimum2 === "number")
    json.minItems = minimum2;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = processSchema(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
function inputOptin(schema) {
  const def = schema._zod.def;
  if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
    return inputOptin(def.out);
  }
  if (def.type === "catch") {
    return inputOptin(def.innerType);
  }
  return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const shape = def.shape;
  const symbolKeys = Object.getOwnPropertySymbols(shape);
  if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
    return;
  }
  json.type = "object";
  json.properties = {};
  for (const key in shape) {
    assignProp(json.properties, key, processSchema(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    }));
  }
  const requiredKeys = [];
  for (const key of Object.keys(shape)) {
    const field = def.shape[key];
    if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) {
      requiredKeys.push(key);
    }
  }
  if (requiredKeys.length > 0) {
    json.required = requiredKeys;
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = processSchema(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
var unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => processSchema(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
var intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = processSchema(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = processSchema(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
  ctx.intersections.push(allOf);
};
function stringifyKeyNames(bySchema, json, visited) {
  if (json.$ref) {
    if (visited.has(json))
      return json;
    visited.add(json);
    const def = bySchema.get(json)?.def;
    if (!def)
      return json;
    const inlined = stringifyKeyNames(bySchema, def, visited);
    return inlined === def ? json : inlined;
  }
  for (const keyword of ["anyOf", "oneOf"]) {
    const branches = json[keyword];
    if (!Array.isArray(branches))
      continue;
    const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
    if (mapped.some((branch, i) => branch !== branches[i]))
      json = { ...json, [keyword]: mapped };
  }
  const types2 = Array.isArray(json.type) ? json.type : [json.type];
  const numericType = !types2.includes("string") && types2.some((t) => t === "number" || t === "integer");
  const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
  if (!numericType && !values?.some((v) => typeof v === "number"))
    return json;
  const { minimum: minimum2, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
  if (rest.enum)
    rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
  else if (typeof rest.const === "number")
    rest.const = String(rest.const);
  if (!numericType)
    return rest;
  rest.type = "string";
  if (!values)
    rest.pattern = (types2.includes("number") ? number : integer).source;
  return rest;
}
var pendingRecords = /* @__PURE__ */ new WeakMap();
function rewriteKeyNames(ctx) {
  const bySchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.values()) {
    if (entry.def && !bySchema.has(entry.schema))
      bySchema.set(entry.schema, entry);
  }
  const rewrites = /* @__PURE__ */ new Map();
  for (const record2 of pendingRecords.get(ctx) ?? []) {
    const seen = ctx.seen.get(record2);
    const names2 = (seen?.def ?? seen?.schema)?.propertyNames;
    if (!names2 || names2 === true || rewrites.has(names2))
      continue;
    const rewritten = stringifyKeyNames(bySchema, names2, /* @__PURE__ */ new Set());
    if (rewritten !== names2)
      rewrites.set(names2, rewritten);
  }
  if (!rewrites.size)
    return;
  for (const entry of ctx.seen.values()) {
    for (const carrier of [entry.schema, entry.def]) {
      const rewritten = carrier && rewrites.get(carrier.propertyNames);
      if (rewritten)
        carrier.propertyNames = rewritten;
    }
  }
}
var recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const patterns3 = aggregateChecks(keyType).patterns;
  if (def.mode === "loose" && patterns3 && patterns3.size > 0) {
    const valueSchema = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns3) {
      assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = processSchema(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
      let pending = pendingRecords.get(ctx);
      if (!pending) {
        pending = [];
        pendingRecords.set(ctx, pending);
        ctx.deferred.push(() => rewriteKeyNames(ctx));
      }
      pending.push(schema);
    }
    json.additionalProperties = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
  if (keyValues && !def.partial && !omittableOnInput) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues.map(String);
    }
  }
};
var nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var UNREPRESENTABLE_DEFAULT = /* @__PURE__ */ Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
  let unrepresentable = false;
  const serialized = JSON.stringify(value, (_, val) => {
    if (typeof val !== "bigint")
      return val;
    unrepresentable = true;
    return null;
  });
  if (!unrepresentable)
    return JSON.parse(serialized);
  handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
  return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io !== "input")
    return;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  processSchema(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};

// node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
  Object.defineProperty(proto, key, {
    configurable: true,
    enumerable: false,
    get() {
      const value = make(this);
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
      return value;
    },
    set(value) {
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
    }
  });
}
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  const proto = Object.getPrototypeOf(inst);
  if (_installedErrorProtos.has(proto))
    return;
  _installedErrorProtos.add(proto);
  _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
  _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
  _lazyMethod(proto, "addIssue", (self) => (issue2) => {
    self.issues.push(issue2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  _lazyMethod(proto, "addIssues", (self) => (issues2) => {
    self.issues.push(...issues2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  Object.defineProperty(proto, "isEmpty", {
    configurable: true,
    enumerable: false,
    get() {
      return this.issues.length === 0;
    }
  });
};
var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, void 0, {
  Parent: Error
});

// node_modules/zod/v4/classic/parse.js
var parse = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
  if (!globalConfig.localeError)
    config(en_default());
}
function _ensureDefaultMemoizer() {
  if (!globalConfig.memoizer)
    config({ memoizer: memoizer() });
}
var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  _ensureDefaultLocale();
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  return inst;
}, {
  check(...chks) {
    const def = this.def;
    return this.clone(util_exports.mergeDefs(def, {
      checks: [
        ...def.checks ?? [],
        ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }), { parent: true });
  },
  with(...chks) {
    return this.check(...chks);
  },
  clone(def, params) {
    return clone(this, def, params);
  },
  brand() {
    return this;
  },
  register(reg, meta2) {
    reg.add(this, meta2);
    return this;
  },
  refine(check, params) {
    return this.check(refine(check, params));
  },
  superRefine(refinement, params) {
    return this.check(superRefine(refinement, params));
  },
  overwrite(fn) {
    return this.check(_overwrite(fn));
  },
  optional() {
    return optional(this);
  },
  exactOptional() {
    return exactOptional(this);
  },
  nullable() {
    return nullable(this);
  },
  nullish() {
    return optional(nullable(this));
  },
  nonoptional(params) {
    return nonoptional(this, params);
  },
  array() {
    return array(this);
  },
  or(arg) {
    return union([this, arg]);
  },
  and(arg) {
    return intersection(this, arg);
  },
  transform(tx) {
    return pipe(this, transform(tx));
  },
  default(d) {
    return _default(this, d);
  },
  prefault(d) {
    return prefault(this, d);
  },
  catch(params) {
    return _catch(this, params);
  },
  pipe(target) {
    return pipe(this, target);
  },
  readonly() {
    return readonly(this);
  },
  describe(description) {
    const cl = this.clone();
    globalRegistry.add(cl, { description });
    return cl;
  },
  meta(...args) {
    if (args.length === 0)
      return globalRegistry.get(this);
    const cl = this.clone();
    globalRegistry.add(cl, args[0]);
    return cl;
  },
  isOptional() {
    return this.safeParse(void 0).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(fn, ...args) {
    return args.length === 0 ? fn(this) : fn(this, ...args);
  },
  // Overrides core's `~standard` to add `jsonSchema`. Must stay a prototype entry: redefining it per instance demotes instances to dictionary mode.
  get "~standard"() {
    return util_exports.hide(this, "~standard", {
      ...standardProps(this),
      jsonSchema: {
        input: createStandardJSONSchemaMethod(this, "input"),
        output: createStandardJSONSchemaMethod(this, "output")
      }
    });
  },
  set "~standard"(value) {
    util_exports.own(this, "~standard", value);
  },
  parse: function _parse2(data, params) {
    return parse(this, data, params, { callee: _parse2 });
  },
  parseAsync: async function _parseAsync2(data, params) {
    return await parseAsync(this, data, params, { callee: _parseAsync2 });
  },
  safeParse(data, params) {
    return safeParse(this, data, params);
  },
  async safeParseAsync(data, params) {
    return safeParseAsync(this, data, params);
  },
  // `spa` is an alias: same function object as `safeParseAsync`, as before.
  get spa() {
    return this?.safeParseAsync;
  },
  set spa(value) {
    util_exports.own(this, "spa", value);
  },
  validate(data, params) {
    return validate(this, data, params);
  },
  validateAsync(data, params) {
    return validateAsync(this, data, params);
  },
  encode: function _encode2(data, params) {
    return encode(this, data, params, { callee: _encode2 });
  },
  decode: function _decode2(data, params) {
    return decode(this, data, params, { callee: _decode2 });
  },
  encodeAsync: async function _encodeAsync2(data, params) {
    return await encodeAsync(this, data, params, { callee: _encodeAsync2 });
  },
  decodeAsync: async function _decodeAsync2(data, params) {
    return await decodeAsync(this, data, params, { callee: _decodeAsync2 });
  },
  safeEncode(data, params) {
    return safeEncode(this, data, params);
  },
  safeDecode(data, params) {
    return safeDecode(this, data, params);
  },
  async safeEncodeAsync(data, params) {
    return safeEncodeAsync(this, data, params);
  },
  async safeDecodeAsync(data, params) {
    return safeDecodeAsync(this, data, params);
  },
  toJSONSchema(params) {
    return createToJSONSchemaMethod(this, {})(params);
  },
  // Reads through to the registry on every access, so it must not cache.
  get description() {
    return globalRegistry.get(this)?.description;
  },
  // No setter: `schema._def = x` throws, as it did when `_def` was a non-writable own property.
  get _def() {
    return this._zod.def;
  }
});
var _ZodString = /* @__PURE__ */ $constructor(
  "_ZodString",
  (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
  },
  /* @__PURE__ */ util_exports.derived({
    format: (inst) => aggregateChecks(inst).format ?? null,
    minLength: (inst) => aggregateChecks(inst).minimum ?? null,
    maxLength: (inst) => aggregateChecks(inst).maximum ?? null
  }, {
    regex(...args) {
      return this.check(_regex(...args));
    },
    includes(...args) {
      return this.check(_includes(...args));
    },
    startsWith(...args) {
      return this.check(_startsWith(...args));
    },
    endsWith(...args) {
      return this.check(_endsWith(...args));
    },
    min(...args) {
      return this.check(_minLength(...args));
    },
    max(...args) {
      return this.check(_maxLength(...args));
    },
    length(...args) {
      return this.check(_length(...args));
    },
    nonempty(...args) {
      return this.check(_minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(_lowercase(params));
    },
    uppercase(params) {
      return this.check(_uppercase(params));
    },
    trim() {
      return this.check(_trim());
    },
    normalize(...args) {
      return this.check(_normalize(...args));
    },
    toLowerCase() {
      return this.check(_toLowerCase());
    },
    toUpperCase() {
      return this.check(_toUpperCase());
    },
    slugify() {
      return this.check(_slugify());
    }
  })
);
var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
}, {
  email(params) {
    return this.check(_email(ZodEmail, params));
  },
  url(params) {
    return this.check(_url(ZodURL, params));
  },
  jwt(params) {
    return this.check(_jwt(ZodJWT, params));
  },
  emoji(params) {
    return this.check(_emoji2(ZodEmoji, params));
  },
  guid(params) {
    return this.check(_guid(ZodGUID, params));
  },
  uuid(params) {
    return this.check(_uuid(ZodUUID, params));
  },
  uuidv4(params) {
    return this.check(_uuidv4(ZodUUID, params));
  },
  uuidv6(params) {
    return this.check(_uuidv6(ZodUUID, params));
  },
  uuidv7(params) {
    return this.check(_uuidv7(ZodUUID, params));
  },
  nanoid(params) {
    return this.check(_nanoid(ZodNanoID, params));
  },
  cuid(params) {
    return this.check(_cuid(ZodCUID, params));
  },
  cuid2(params) {
    return this.check(_cuid2(ZodCUID2, params));
  },
  ulid(params) {
    return this.check(_ulid(ZodULID, params));
  },
  base64(params) {
    return this.check(_base64(ZodBase64, params));
  },
  base64url(params) {
    return this.check(_base64url(ZodBase64URL, params));
  },
  xid(params) {
    return this.check(_xid(ZodXID, params));
  },
  ksuid(params) {
    return this.check(_ksuid(ZodKSUID, params));
  },
  ipv4(params) {
    return this.check(_ipv4(ZodIPv4, params));
  },
  ipv6(params) {
    return this.check(_ipv6(ZodIPv6, params));
  },
  cidrv4(params) {
    return this.check(_cidrv4(ZodCIDRv4, params));
  },
  cidrv6(params) {
    return this.check(_cidrv6(ZodCIDRv6, params));
  },
  e164(params) {
    return this.check(_e164(ZodE164, params));
  },
  datetime(params) {
    return this.check(_isoDateTime(ZodISODateTime, params));
  },
  date(params) {
    return this.check(_isoDate(ZodISODate, params));
  },
  time(params) {
    return this.check(_isoTime(ZodISOTime, params));
  },
  duration(params) {
    return this.check(_isoDuration(ZodISODuration, params));
  }
});
function string2(params) {
  return _string(ZodString, params);
}
var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNumber = /* @__PURE__ */ $constructor(
  "ZodNumber",
  (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
    inst.isFinite = true;
  },
  /* @__PURE__ */ util_exports.derived({
    minValue: (inst) => {
      const { minimum: minimum2, exclusiveMinimum } = aggregateChecks(inst);
      return Math.max(minimum2 ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
    },
    maxValue: (inst) => {
      const { maximum, exclusiveMaximum } = aggregateChecks(inst);
      return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
    },
    isInt: (inst) => {
      const { isInt, multipleOf } = aggregateChecks(inst);
      return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
    },
    format: (inst) => aggregateChecks(inst).format ?? null
  }, {
    gt(value, params) {
      return this.check(_gt(value, params));
    },
    gte(value, params) {
      return this.check(_gte(value, params));
    },
    min(value, params) {
      return this.check(_gte(value, params));
    },
    lt(value, params) {
      return this.check(_lt(value, params));
    },
    lte(value, params) {
      return this.check(_lte(value, params));
    },
    max(value, params) {
      return this.check(_lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(_gt(0, params));
    },
    nonnegative(params) {
      return this.check(_gte(0, params));
    },
    negative(params) {
      return this.check(_lt(0, params));
    },
    nonpositive(params) {
      return this.check(_lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(_multipleOf(value, params));
    },
    step(value, params) {
      return this.check(_multipleOf(value, params));
    },
    finite() {
      return this;
    }
  })
);
function number2(params) {
  return _number(ZodNumber, params);
}
var ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return _int(ZodNumberFormat, params);
}
var ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
  return _unknown(ZodUnknown);
}
var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
  return _never(ZodNever, params);
}
var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
}, {
  min(n, params) {
    return this.check(_minLength(n, params));
  },
  nonempty(params) {
    return this.check(_minLength(1, params));
  },
  max(n, params) {
    return this.check(_maxLength(n, params));
  },
  length(n, params) {
    return this.check(_length(n, params));
  },
  unwrap() {
    return this.element;
  }
});
function array(element, params) {
  return _array(ZodArray, element, params);
}
var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  util_exports.installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
  keyof() {
    return _enum(Object.keys(this._zod.def.shape));
  },
  catchall(catchall) {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall }));
  },
  passthrough() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  loose() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  strict() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: never() }));
  },
  strip() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: void 0 }));
  },
  extend(incoming) {
    return util_exports.extend(this, incoming);
  },
  safeExtend(incoming) {
    return util_exports.safeExtend(this, incoming);
  },
  merge(other) {
    return util_exports.merge(this, other);
  },
  pick(mask) {
    return util_exports.pick(this, mask);
  },
  omit(mask) {
    return util_exports.omit(this, mask);
  },
  partial(...args) {
    return util_exports.partial(ZodOptional, this, args[0]);
  },
  exactPartial(...args) {
    return util_exports.partial(ZodExactOptional, this, args[0], "exactPartial");
  },
  required(...args) {
    return util_exports.required(ZodNonOptional, this, args[0]);
  }
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...util_exports.normalizeParams(params)
  };
  return new ZodObject(def);
}
var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...util_exports.normalizeParams(params)
  });
}
var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
var ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodRecord.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string2(),
      valueType: keyType,
      ...util_exports.normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
  inst.enum = def.entries;
  inst.options = [...inst._zod.values];
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...util_exports.normalizeParams(params)
  });
}
var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(util_exports.issue(issue2, payload.value, def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(util_exports.issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    payload.value = output;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : util_exports.constantCatch(catchValue)
  });
}
var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}

// src/rules/ids.ts
var ruleIds = [
  "incomplete-review",
  "secret-in-diff",
  "credential-file",
  "hardcoded-jwt-secret",
  "secret-logging",
  "url-credentials",
  "disabled-security-check",
  "hidden-unicode",
  "large-diff",
  "missing-tests",
  "skipped-tests",
  "blanket-suppression",
  "risky-api",
  "unescaped-html",
  "timing-unsafe-comparison",
  "postmessage-origin",
  "nosql-injection",
  "template-injection",
  "prototype-pollution",
  "ldap-xpath-injection",
  "upload-filename",
  "reflected-xss",
  "log-injection",
  "static-iv",
  "plaintext-password",
  "admin-route-auth",
  "zip-slip",
  "regex-injection",
  "electron-security",
  "unsafe-reflection",
  "command-injection",
  "weak-password-hashing",
  "hardcoded-session-secret",
  "jwt-without-expiry",
  "sql-injection",
  "insecure-web-config",
  "weak-crypto",
  "untrusted-input",
  "xml-external-entities",
  "mass-assignment",
  "redos",
  "remote-script",
  "workflow-risk",
  "unpinned-action",
  "destructive-migration",
  "privileged-container",
  "dockerfile-risk",
  "public-exposure",
  "insecure-infrastructure",
  "kubernetes-rbac",
  "file-permissions",
  "sensitive-files",
  "config-change",
  "review-control-change",
  "lockfile-source",
  "lookalike-dependency",
  "risky-dependency-version",
  "stale-lockfile",
  "dependency-risk",
  "oversized-patch"
];

// src/config/schema.ts
var knownRuleIds = new Set(ruleIds);
var severityMap = record(string2(), _enum(["off", "info", "warning", "high"])).superRefine((overrides, context) => {
  for (const id of Object.keys(overrides)) {
    if (!knownRuleIds.has(id)) {
      context.addIssue({ code: "custom", message: `Unknown rule "${id}".` });
    }
  }
});
var prismConfigSchema = object({
  risk: object({
    largeDiff: object({
      maxFiles: number2().int().positive().default(25),
      maxChangedLines: number2().int().positive().default(800)
    }).prefault({})
  }).prefault({}),
  rules: object({
    missingTests: object({
      enabled: boolean2().default(true),
      sourceGlobs: array(string2()).default(["src/**/*.{ts,tsx,js,jsx}"]),
      testGlobs: array(string2()).default([
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        // Test directories, such as Mocha's test/, pytest's and Cargo's tests/, and RSpec's spec/.
        "**/test/**",
        "**/tests/**",
        "**/spec/**",
        "**/test_*.py",
        "**/*_test.py",
        "**/tests.py",
        "**/*_test.go",
        "**/*_spec.rb",
        "**/*_test.rb",
        "**/src/test/**",
        "**/*Test.php",
        "**/*Tests.cs",
        "**/*Test.cs",
        "**/*.Tests/**",
        "**/*Tests.swift"
      ])
    }).prefault({}),
    sensitiveFiles: object({
      enabled: boolean2().default(true),
      patterns: array(string2()).default([
        ".github/workflows/**",
        "**/auth/**",
        "**/permissions/**",
        "**/migrations/**"
      ])
    }).prefault({}),
    dependencyRisk: object({
      enabled: boolean2().default(true),
      manifests: array(string2()).default([
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "requirements.txt",
        "pyproject.toml",
        "poetry.lock",
        "go.mod",
        "go.sum",
        "Cargo.toml",
        "Cargo.lock"
      ])
    }).prefault({}),
    secretInDiff: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    skippedTests: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    blanketSuppression: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    riskyApis: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    remoteScripts: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    disabledSecurityChecks: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    untrustedInput: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    weakCrypto: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    xmlExternalEntities: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    massAssignment: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    redos: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    insecureWebConfig: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    sqlInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    hiddenUnicode: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    workflowRisk: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    unpinnedActions: object({
      enabled: boolean2().default(true),
      // Owners whose actions may be used by tag, compared without case. GitHub's own by default.
      allowedOwners: array(string2().min(1).max(100)).default(["actions", "github"])
    }).prefault({}),
    destructiveMigration: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    dockerfileRisk: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    privilegedContainers: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    filePermissions: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    kubernetesRbac: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    insecureInfrastructure: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    publicExposure: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    credentialFiles: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    hardcodedJwtSecret: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    secretLogging: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    urlCredentials: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    unescapedHtml: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    timingUnsafeComparison: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    postMessageOrigin: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    nosqlInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    templateInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    prototypePollution: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    ldapXpathInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    uploadFilename: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    reflectedXss: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    logInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    staticIv: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    plaintextPassword: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    adminRouteAuth: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    zipSlip: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    regexInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    electronSecurity: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    unsafeReflection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    commandInjection: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    weakPasswordHashing: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    hardcodedSessionSecret: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    jwtWithoutExpiry: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    staleLockfiles: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    riskyDependencyVersions: object({
      enabled: boolean2().default(true)
    }).prefault({}),
    lookalikeDependencies: object({
      enabled: boolean2().default(true),
      // Dependency names known to be the intended packages, though they look like popular ones.
      allowed: array(string2().min(1).max(214)).max(500).default([])
    }).prefault({}),
    lockfileSources: object({
      enabled: boolean2().default(true),
      // URL prefixes of private registries, added to the public ones.
      allowedSources: array(string2().max(500).refine(isRegistryUrl, "Must be an http or https URL, such as https://npm.pkg.github.com/.")).default([])
    }).prefault({})
  }).prefault({}),
  security: object({
    maxPatchBytes: number2().int().positive().default(2e5),
    redaction: object({
      allowlist: array(
        string2().min(1).max(200).refine(isRegularExpression, "Must be a valid regular expression.")
      ).default([])
    }).prefault({})
  }).prefault({}),
  comment: object({
    mode: _enum(["upsert", "append"]).default("upsert"),
    includeLowSeverity: boolean2().default(false),
    // The repository's own questions, added to every review's checklist.
    checklist: array(string2().trim().min(1).max(300)).max(10).default([]),
    // Names the CODEOWNERS owners of each flagged file.
    codeOwners: boolean2().default(true),
    // Lists the dependencies the pull request adds, removes, or moves to another version.
    dependencyChanges: boolean2().default(true)
  }).prefault({}),
  ignorePaths: array(string2()).default([]),
  // Leaves files marked `linguist-generated` or `linguist-vendored` in .gitattributes, and the paths
  // Linguist treats as vendored, such as `vendor/` and `dist/`, out like ignorePaths.
  ignoreGenerated: boolean2().default(true),
  severity: severityMap.prefault({}),
  // Severity for findings in matching files, applied after `severity`; later entries win.
  overrides: array(
    object({
      paths: array(string2().min(1).max(500)).min(1),
      severity: severityMap
    })
  ).default([]),
  check: object({
    failOn: _enum(["never", "warning", "high"]).default("never")
  }).prefault({}),
  annotations: object({
    enabled: boolean2().default(false),
    includeLowSeverity: boolean2().default(false)
  }).prefault({}),
  // Line findings as pull request review comments on the changed lines.
  reviewComments: object({
    enabled: boolean2().default(false),
    includeLowSeverity: boolean2().default(false),
    maxComments: number2().int().min(1).max(100).default(25)
  }).prefault({}),
  // An advisory summary written by a language model from the redacted diff. Off unless enabled,
  // and it needs the `ai-api-key` input, since it sends the diff to the provider's API.
  ai: object({
    enabled: boolean2().default(false),
    provider: _enum(["anthropic"]).default("anthropic"),
    model: string2().trim().regex(/^[\w.:@/-]{1,100}$/, "Must be a model name, such as claude-opus-5-5.").default("claude-opus-5-5"),
    // The diff text sent, in characters; files past it are sent by name only.
    maxInputCharacters: number2().int().min(1e3).max(5e5).default(1e5),
    timeoutSeconds: number2().int().min(10).max(600).default(120)
  }).prefault({})
});
function isRegularExpression(source) {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}
function isRegistryUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
var defaultConfigPath = ".prism-review.yml";
var defaultConfig = prismConfigSchema.parse({});

// src/analysis/added-lines.ts
var hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/;
function patchLines(patch) {
  const lines = [];
  let newLine;
  let startsHunk = false;
  let hunkContext;
  for (const line of patch.split(/\r?\n/)) {
    const header2 = hunkHeader.exec(line);
    if (header2) {
      newLine = Number(header2[1]);
      startsHunk = true;
      hunkContext = header2[2] || void 0;
      continue;
    }
    if (newLine === void 0 || line.startsWith("\\") || line.startsWith("-")) {
      continue;
    }
    lines.push({
      line: newLine,
      content: line.slice(1),
      added: line.startsWith("+"),
      startsHunk,
      ...startsHunk && hunkContext !== void 0 ? { hunkContext } : {}
    });
    startsHunk = false;
    newLine += 1;
  }
  return lines;
}
function addedLines(patch) {
  return patchLines(patch).filter((line) => line.added).map(({ line, content }) => ({ line, content }));
}
function matchAddedLines(patch, patterns3, ignoreLine) {
  return addedLines(patch).flatMap(
    ({ line, content }) => ignoreLine?.test(content) ? [] : patterns3.filter(([, pattern]) => pattern.test(content)).map(([label]) => ({ line, label }))
  );
}

// src/rules/line-list.ts
var maxListedLines = 5;
function describeLines(lines) {
  const sorted = [...new Set(lines)].sort((left, right) => left - right);
  const listed = sorted.slice(0, maxListedLines).join(", ");
  const more = sorted.length > maxListedLines ? ` and ${sorted.length - maxListedLines} more` : "";
  const plural = sorted.length > 1;
  return { text: `${plural ? "Lines" : "Line"} ${listed}${more}`, plural };
}

// src/rules/blanket-suppression.ts
var noqa = /#\s*(?:(?:flake8|ruff):\s*)?noqa\b(?!\s*:)/i;
var importLine = /^\s*(?:from\s+[\w.]+\s+)?import\s/;
function pythonExempt({ content }, label, closesString) {
  if (importLine.test(content)) {
    return true;
  }
  if (label !== "flake8 or Ruff") {
    return false;
  }
  const marker2 = noqa.exec(content);
  if (marker2 === null || /(?:flake8|ruff)\s*:\s*noqa/i.test(marker2[0])) {
    return false;
  }
  const comment = /^\s*#/.exec(content);
  return closesString || comment !== null && content.slice(comment[0].length, marker2.index).trim() !== "";
}
var languages = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    markers: [
      ["ESLint", /\beslint-disable(?:-next-line|-line)?(?=\s*(?:\*\/|--|$))/],
      // Both directives only take effect in a comment that starts the line.
      ["TypeScript", /^\s*(?:\/\/|\/\*+|\*)\s*@ts-(?:nocheck|ignore)\b/]
    ]
  },
  {
    files: /\.pyi?$/,
    markers: [
      ["flake8 or Ruff", noqa],
      ["Python type checker", /#\s*type:\s*ignore\b(?!\[)|#\s*mypy:\s*ignore-errors\b/],
      ["Pylint", /#\s*pylint:\s*disable\s*=\s*all\b/]
    ],
    exempt: pythonExempt
  },
  { files: /\.go$/, markers: [["golangci-lint", /\/\/\s*nolint\b(?!:)/]] },
  {
    files: /\.cs$/,
    markers: [
      // Codes after `disable` make it targeted; a trailing comment alone does not.
      ["C# compiler", /^\s*#pragma\s+warning\s+disable\s*(?:$|\/\/)/],
      ["ReSharper", /\/\/\s*ReSharper\s+disable\s+All\b/]
    ]
  },
  { files: /\.swift$/, markers: [["SwiftLint", /\/\/\s*swiftlint:disable(?::next|:this|:previous)?\s+all\b/]] },
  { files: /\.(?:rb|rake)$/, markers: [["RuboCop", /#\s*rubocop:\s*(?:disable|todo)\s+all\b/]] },
  {
    files: /\.(?:java|kt)$/,
    markers: [
      ["compiler warnings", /@SuppressWarnings\(\s*(?:value\s*=\s*)?\{?\s*"all"/],
      ["Checkstyle", /\/\/\s*CHECKSTYLE:\s*OFF\b/],
      ["SonarQube", /\/\/\s*NOSONAR\b(?!\s*\()/]
    ]
  },
  {
    files: /\.php$/,
    markers: [
      // The newer `@phpstan-ignore identifier` form names what it ignores.
      ["PHPStan", /@phpstan-ignore-(?:next-)?line\b/],
      // A sniff name after the directive makes it targeted; `-- reason` alone does not.
      [
        "PHP_CodeSniffer",
        /\bphpcs:ignoreFile\b|\bphpcs:(?:ignore|disable)\b(?!\s+[\w.]+)|@codingStandardsIgnore(?:File|Line|Start)\b/
      ],
      ["Psalm", /@psalm-suppress\s+all\b/i]
    ]
  },
  { files: /\.rs$/, markers: [["Rust lints", /#!?\[allow\([^)]{0,500}\b(?:warnings|clippy::all)\b[^)]{0,500}\)\]/]] }
];
var blanketSuppressionRule = {
  id: "blanket-suppression",
  description: "Flags lint and type check suppressions that do not name the checks they turn off.",
  run({ files, config: config2 }) {
    if (!config2.rules.blanketSuppression.enabled) {
      return [];
    }
    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (!language || file.patch === void 0) {
        return [];
      }
      const found = findMarkers(patchLines(file.patch), language);
      if (found.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const kinds3 = [...new Set(found.map((match2) => match2.label))].join(", ");
      return [
        {
          ruleId: "blanket-suppression",
          title: "Blanket lint suppression added",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "turn" : "turns"} off lint or type checks without naming which ones (${kinds3}), so new problems in ${plural ? "their" : "its"} scope go unreported.`,
          recommendation: "Name the specific rule being suppressed and add a short reason, or fix the underlying problem."
        }
      ];
    });
  }
};
function findMarkers(lines, language) {
  const found = [];
  let inString = false;
  for (const line of lines) {
    if (line.startsHunk) {
      inString = false;
    }
    const quotes = (line.content.match(/"""|'''/g) ?? []).length;
    const closesString = inString && quotes % 2 === 1;
    if (quotes % 2 === 1) {
      inString = !inString;
    }
    if (!line.added) {
      continue;
    }
    for (const [label, pattern] of language.markers) {
      if (pattern.test(line.content) && !language.exempt?.(line, label, closesString)) {
        found.push({ line: line.line, label });
      }
    }
  }
  return found;
}

// src/analysis/repository-path.ts
function normalizeRepositoryPath(path2) {
  return path2.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}
var testDataDirectory = /(?:^|\/)(?:tests?|testdata|fixtures|__fixtures__|__tests__|__mocks__|spec)\//i;
function isTestDataPath(path2) {
  return testDataDirectory.test(path2);
}

// src/rules/config-change.ts
var configChangeRule = {
  id: "config-change",
  seesIgnoredFiles: true,
  description: "Flags pull requests that change the Prism Review configuration or a file it extends.",
  run({ files, configPath, extendedConfigPaths = [] }) {
    const target = normalizeRepositoryPath(configPath);
    const extended2 = new Set(extendedConfigPaths.map(normalizeRepositoryPath));
    const matches = (file, paths) => [file.path, file.previousPath].some((path2) => path2 !== void 0 && paths.has(normalizeRepositoryPath(path2)));
    return files.filter((file) => matches(file, /* @__PURE__ */ new Set([target])) || matches(file, extended2)).map((file) => ({
      ruleId: "config-change",
      title: "Review configuration changed",
      severity: "high",
      file: file.path,
      message: matches(file, /* @__PURE__ */ new Set([target])) ? "This file is the Prism Review configuration, which controls how pull requests are reviewed." : "The Prism Review configuration extends this file, which controls how pull requests are reviewed.",
      recommendation: "Confirm that thresholds, rule patterns, and redaction allowlist entries were not relaxed to hide findings."
    }));
  }
};

// src/analysis/code-owners.ts
var codeOwnersPaths = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
var maxRules = 5e3;
var maxPatternLength = 500;
var ownerToken = /^(?:@[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\/[A-Za-z0-9._-]{1,100})?|[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63})$/;
function parseCodeOwners(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(?:^|\s)#.*$/, "").trim();
    if (line === "" || rules.length >= maxRules) {
      continue;
    }
    const [pattern = "", ...tokens] = line.split(/\s+/);
    if (pattern.length > maxPatternLength || pattern.startsWith("!") || /[[\]]/.test(pattern)) {
      continue;
    }
    const globs = patternGlobs(pattern);
    if (globs.length > 0) {
      rules.push({ globs, owners: tokens.filter((token2) => ownerToken.test(token2)) });
    }
  }
  return {
    ownersOf(path2) {
      for (let index = rules.length - 1; index >= 0; index -= 1) {
        const rule = rules[index];
        if (rule?.globs.some((glob) => minimatch(path2, glob, { dot: true }))) {
          return rule.owners;
        }
      }
      return [];
    }
  };
}
function patternGlobs(pattern) {
  const directoryOnly = pattern.endsWith("/");
  let glob = pattern.replace(/\/+$/, "");
  const anchored = glob.includes("/");
  glob = glob.replace(/^\/+/, "");
  if (glob === "") {
    return [];
  }
  if (!anchored) {
    glob = `**/${glob}`;
  }
  if (directoryOnly) {
    return [`${glob}/**`];
  }
  return glob.split("/").pop() === "*" ? [glob] : [glob, `${glob}/**`];
}

// src/rules/review-control-change.ts
var linguistAttribute = /\blinguist-(?:generated|vendored)\b/;
var hunkHeader2 = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
var reviewControlChangeRule = {
  id: "review-control-change",
  seesIgnoredFiles: true,
  description: "Flags changes to CODEOWNERS and to the files .gitattributes marks generated or vendored.",
  run({ files }) {
    return files.flatMap((file) => {
      const paths = [file.path, file.previousPath].filter((path2) => path2 !== void 0);
      if (paths.some((path2) => codeOwnersPaths.includes(path2))) {
        return [codeOwnersFinding(file)];
      }
      if (paths.some((path2) => path2 === ".gitattributes" || path2.endsWith("/.gitattributes"))) {
        return gitAttributesFindings(file);
      }
      return [];
    });
  }
};
function codeOwnersFinding(file) {
  return {
    ruleId: "review-control-change",
    title: "Code owners changed",
    severity: "warning",
    file: file.path,
    message: file.status === "removed" ? "This pull request removes a CODEOWNERS file, so later pull requests no longer require reviews from the owners it named." : "This pull request changes CODEOWNERS, which decides whose review later pull requests require for each path.",
    recommendation: "Have the current owners of the affected paths approve the change, and check that no path lost its owner."
  };
}
function gitAttributesFindings(file) {
  if (file.patch === void 0) {
    return [gitAttributesFinding(file, "This .gitattributes change could not be inspected, so it may change", [])];
  }
  const { touched, added } = linguistChanges(file.patch);
  if (!touched) {
    return [];
  }
  if (added.length === 0) {
    return [gitAttributesFinding(file, "This change removes lines that set", [])];
  }
  const { text, plural } = describeLines(added);
  return [gitAttributesFinding(file, `${text} ${plural ? "change" : "changes"}`, added)];
}
function gitAttributesFinding(file, opening, lines) {
  return {
    ruleId: "review-control-change",
    title: "Generated file markers changed",
    severity: "warning",
    file: file.path,
    ...lines.length > 0 ? { line: Math.min(...lines), lines } : {},
    message: `${opening} which files are marked linguist-generated or linguist-vendored. GitHub collapses those files in diffs and Prism Review leaves them out of its noise rules, so the change affects how later pull requests are reviewed.`,
    recommendation: "Check that only generated or third-party files are marked, and that no source directory is."
  };
}
function linguistChanges(patch) {
  const added = [];
  let touched = false;
  let newLine;
  for (const line of patch.split(/\r?\n/)) {
    const header2 = hunkHeader2.exec(line);
    if (header2) {
      newLine = Number(header2[1]);
      continue;
    }
    if (newLine === void 0 || line.startsWith("\\")) {
      continue;
    }
    if (line.startsWith("-")) {
      touched ||= linguistAttribute.test(line);
      continue;
    }
    if (line.startsWith("+") && linguistAttribute.test(line)) {
      touched = true;
      added.push(newLine);
    }
    newLine += 1;
  }
  return { touched, added };
}

// src/security/credential-files.ts
var wholeFileKinds = [
  ["a private key", /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$|\.ppk$|(?:^|\/)(?:privkey[^/]*|(?:[^/]*[-_])?(?<!pub(?:lic)?[-_])key)\.pem$/i],
  ["a key store", /\.(?:p12|pfx|jks|keystore|bks)$/i],
  ["a Terraform state file", /\.tfstate(?:\.backup)?$/i],
  ["a credentials file", /(?:^|\/)(?:\.git-credentials|\.netrc|_netrc|\.pgpass|\.htpasswd)$|(?:^|\/)\.aws\/credentials$/i],
  ["a Docker credentials file", /(?:^|\/)\.docker\/config\.json$/i],
  ["a Kubernetes config file", /(?:^|\/)\.kube\/config$|(?:^|\/)kubeconfig$|\.kubeconfig$/i],
  ["a cloud service account key", /(?:^|\/)(?:service[-_]?account|client_secret)[^/]*\.json$/i]
];
var keyFile = /\.key$/i;
var environmentFile = /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.env)$/i;
var exampleFile = /(?:^|[./])(?:example|sample|template|tmpl|tpl|dist|defaults?|schema)(?:[./]|$)/i;
var registryFile = /(?:^|\/)(?:\.npmrc|\.yarnrc(?:\.yml)?|\.pypirc)$/i;
var commentLine = /^\s*[#;]/;
var assignment = /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*[=:]\s*(.*)$/;
var secretName = /(?:secret|passw(?:or)?d|[_.-]pass|[_.-]pwd|token|credentials?|(?:api|private|access|secret|signing|encryption|master)[_.-]?key|secret[_.-]?key[_.-]?base)$/i;
var publicName = /^(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|GATSBY_|PUBLIC_)/i;
var urlPassword = /\b[a-z][\w+.-]*:\/\/[^\s:@/]+:([^\s@/]+)@(\[[^\]\s]*\]|[^\s:/?#]+)/i;
var localHost = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)$/i;
var registryToken = /(?:_authToken|_auth|_password|npmAuthToken|npmAuthIdent)\s*[=:]\s*(.*)$|^\s*password\s*[=:]\s*(.*)$/i;
var placeholder = /^(?:|\$\{?[\w:-]*\}?|<[^>]*>|x+|\*+|\.{3}|change[_-]?me|replace[_-]?me|your[\w-]*|placeholder|example|todo|tbd|none|null|true|false|\d)$/i;
var filePath = /^(?:~|\.{1,2})?\/[\w.-]+(?:\/[\w.-]+)+$|^(?:~\/|\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:json|pem|key|p12|pfx|jks|crt)$/i;
var localDefault = /^(?:password|passw0rd|pass|secret|postgres|mysql|root|admin|guest|dev|development|test|local|default|123456)$/i;
function credentialFileKind(path2) {
  if (isTestDataPath(path2)) {
    return void 0;
  }
  if (environmentFile.test(path2)) {
    return exampleFile.test(path2.slice(path2.lastIndexOf("/") + 1)) ? void 0 : { name: "an environment file", checksLines: true };
  }
  if (registryFile.test(path2)) {
    return { name: "a package manager configuration file", checksLines: true };
  }
  if (keyFile.test(path2)) {
    return { name: "a key file", checksLines: false, textOnly: true };
  }
  const name = wholeFileKinds.find(([, pattern]) => pattern.test(path2))?.[0];
  return name === void 0 ? void 0 : { name, checksLines: false };
}
function findCredentialLines(path2, patch) {
  const check = registryFile.test(path2) ? registrySecret : environmentSecret;
  return addedLines(patch).filter(({ content }) => !commentLine.test(content) && check(content)).map(({ line }) => line);
}
function environmentSecret(content) {
  const match2 = assignment.exec(content);
  if (!match2) {
    return false;
  }
  const [, name = "", raw = ""] = match2;
  const value = cleanValue(raw);
  const url = urlPassword.exec(value);
  if (url) {
    return !isPlaceholder(url[1] ?? "") && !localHost.test(url[2] ?? "");
  }
  return secretName.test(name) && !publicName.test(name) && !isPlaceholder(value);
}
function registrySecret(content) {
  const match2 = registryToken.exec(content);
  return match2 !== null && !isPlaceholder(cleanValue(match2[1] ?? match2[2] ?? ""));
}
function isPlaceholder(value) {
  return placeholder.test(value) || localDefault.test(value) || filePath.test(value);
}
function cleanValue(raw) {
  const value = raw.trim();
  const quoted3 = /^(["'])(.*)\1/.exec(value);
  if (quoted3) {
    return quoted3[2] ?? "";
  }
  return value.replace(/\s+#.*$/, "");
}

// src/rules/credential-file.ts
var exposure = "readable by anyone with access to the repository";
var recommendation = "Treat the credentials as exposed and rotate them, remove the file from the branch history, and add it to .gitignore. Commit an example file with placeholder values instead, or read the value from an environment variable such as ${NPM_TOKEN}.";
var credentialFileRule = {
  id: "credential-file",
  description: "Flags private keys, Terraform state, and other files that hold credentials, and secrets added to .env and .npmrc files.",
  seesIgnoredFiles: true,
  run({ files, config: config2 }) {
    if (!config2.rules.credentialFiles.enabled) {
      return [];
    }
    return files.flatMap((file) => {
      const kind = file.status === "removed" ? void 0 : credentialFileKind(file.path);
      if (kind === void 0 || kind.textOnly && file.patch === void 0) {
        return [];
      }
      if (!kind.checksLines) {
        return [
          {
            ruleId: "credential-file",
            title: "Credential file committed",
            severity: "high",
            file: file.path,
            message: `This is ${kind.name}, a kind of file that usually holds credentials, so they would be ${exposure}.`,
            recommendation
          }
        ];
      }
      const lines = credentialLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      const what = kind.name === "an environment file" ? plural ? "secrets" : "a secret" : plural ? "registry tokens" : "a registry token";
      return [
        {
          ruleId: "credential-file",
          title: "Credential added to a configuration file",
          severity: "high",
          file: file.path,
          line: Math.min(...lines),
          message: `${text} ${plural ? "add" : "adds"} ${what} to ${kind.name}, so ${plural ? "they" : "it"} would be ${exposure}.`,
          recommendation
        }
      ];
    });
  }
};
function credentialLines(file) {
  if (file.credentialLines !== void 0) {
    return file.credentialLines;
  }
  return file.patch === void 0 ? [] : findCredentialLines(file.path, file.patch);
}

// src/security/jwt-keys.ts
var keyedCalls = [
  // jsonwebtoken and PyJWT: jwt.sign(payload, key), jwt.verify(token, key), jwt.encode, jwt.decode.
  { call: /\bjwt\.(?:sign|verify|encode|decode)\s*\(/g, argument: 1 },
  // ruby-jwt and firebase/php-jwt.
  { call: /\bJWT(?:\.|::)(?:encode|decode)\s*\(/g, argument: 1 },
  { call: /\bnew\s+Key\s*\(/g, argument: 0, files: /\.php$/i },
  // Auth0's java-jwt and jjwt.
  { call: /\bAlgorithm\.HMAC(?:256|384|512)\s*\(/g, argument: 0 },
  { call: /\.(?:signWith|setSigningKey)\s*\(/g, argument: "any" },
  { call: /\bKeys\.hmacShaKeyFor\s*\(/g, argument: 0 },
  // golang-jwt and .NET.
  { call: /\.SignedString\s*\(/g, argument: 0 },
  { call: /\bSymmetricSecurityKey\s*\(/g, argument: 0 }
];
var keywordName = /^(?:key|secret|secret_key|signing_key)\s*=\s*/;
var byteWrappers = [/^\[\]byte\(\s*(.*?)\s*\)$/s, /^Encoding\.\w+\.GetBytes\(\s*(.*?)\s*\)$/s, /^(.*?)\s*\.(?:getBytes|encode)\(\s*[^()]*\)$/s];
var stringLiteral = /^(?:[bBrRuU]{1,2})?(["'`])((?:\\.|(?!\1).)*)\1$/s;
var publicKey = /^-----BEGIN (?:PUBLIC KEY|CERTIFICATE|RSA PUBLIC KEY)/;
var commentLine2 = /^\s*(?:#|\/\/|\/\*|\*|--|>>>)/;
var maxLineLength = 1e3;
var mentionsJwt = /jwt|Key|HMAC|signWith|SignedString/i;
function findJwtKeyLines(path2, patch) {
  return patchLines(patch).flatMap(
    ({ line, content, added }) => added && content.length <= maxLineLength && mentionsJwt.test(content) && !commentLine2.test(content) && hasLiteralKey(path2, content) ? [line] : []
  );
}
function hasLiteralKey(path2, content) {
  return keyedCalls.some(({ call, argument, files }) => {
    if (files !== void 0 && !files.test(path2)) {
      return false;
    }
    for (const match2 of content.matchAll(call)) {
      const args = callArguments(content, match2.index + match2[0].length);
      const keys = argument === "any" ? args : args.slice(argument, argument + 1);
      if (keys.some(isLiteralKey)) {
        return true;
      }
    }
    return false;
  });
}
function isLiteralKey(argument) {
  let value = argument.trim().replace(keywordName, "");
  for (const wrapper of byteWrappers) {
    value = wrapper.exec(value)?.[1] ?? value;
  }
  const literal3 = stringLiteral.exec(value);
  if (literal3 === null) {
    return false;
  }
  const [, quote, text = ""] = literal3;
  return !(quote === "`" && text.includes("${")) && !publicKey.test(text);
}
function callArguments(content, start) {
  const args = [];
  let depth = 0;
  let quote;
  let current = "";
  for (let index = start; index < content.length; index += 1) {
    const char = content[index] ?? "";
    if (quote !== void 0) {
      current += char;
      if (char === "\\") {
        current += content[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "") {
    args.push(current);
  }
  return args;
}

// src/rules/hardcoded-jwt-secret.ts
var documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var hardcodedJwtSecretRule = {
  id: "hardcoded-jwt-secret",
  description: "Flags JSON Web Tokens signed or verified with a key written in the code.",
  run({ files, config: config2 }) {
    if (!config2.rules.hardcodedJwtSecret.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (documentation.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = jwtKeyLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "hardcoded-jwt-secret",
          title: "JWT key written in the code",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "sign or verify" : "signs or verifies"} JSON Web Tokens with a key written in the code, so anyone who can read the code can make tokens the application accepts.`,
          recommendation: "Load the key from a secret store or an environment variable, and replace the key that was committed. When other services only verify tokens, an asymmetric algorithm such as RS256 or EdDSA lets them do it without the signing key."
        }
      ];
    });
  }
};
function jwtKeyLines(file) {
  if (file.jwtKeyLines !== void 0) {
    return file.jwtKeyLines;
  }
  return file.patch === void 0 ? [] : findJwtKeyLines(file.path, file.patch);
}

// src/security/secret-logs.ts
var logCall = new RegExp(
  [
    String.raw`\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(`,
    String.raw`\b(?:logger|log|_logger|LOGGER|LOG|logging|Logger|Log|winston|pino|bunyan|signale|self\.logger|self\.log|this\.logger|this\.log|Rails\.logger|app\.logger|current_app\.logger)\.(?:log|info|warn|warning|error|debug|trace|fatal|critical|exception|verbose|notice|Debug|Info|Warn|Error|Fatal|Print|Printf|Println|Debugf|Infof|Warnf|Errorf|Fatalf|LogInformation|LogDebug|LogWarning|LogError|LogTrace|LogCritical)\s*[(\s]`,
    String.raw`\blog\.(?:Print|Printf|Println|Fatal|Fatalf|Fatalln|Panic|Panicf)\s*\(`,
    String.raw`\bSystem\.(?:out|err)\.print(?:ln|f)?\s*\(`,
    String.raw`\bConsole\.(?:Write|WriteLine)\s*\(`,
    String.raw`\berror_log\s*\(|\bLog::(?:debug|info|notice|warning|error|critical|alert|emergency)\s*\(`
  ].join("|")
);
var secretWords = /* @__PURE__ */ new Set(["password", "passwd", "passphrase", "secret", "token", "apikey", "credential", "credentials", "authorization", "privatekey", "cvv"]);
var secretPairs = [
  ["api", "key"],
  ["private", "key"],
  ["access", "key"],
  ["client", "secret"],
  ["card", "number"],
  ["session", "id"]
];
var describingWords = /* @__PURE__ */ new Set([
  "length",
  "len",
  "size",
  "count",
  "type",
  "types",
  "name",
  "names",
  "field",
  "fields",
  "label",
  "hint",
  "policy",
  "expiry",
  "expires",
  "expiration",
  "ttl",
  "url",
  "uri",
  "path",
  "file",
  "filename",
  "header",
  "masked",
  "redacted",
  "hash",
  "hashed",
  "digest",
  "fingerprint",
  "valid",
  "invalid",
  "required",
  "strength",
  "changed",
  "set",
  "exists",
  "present",
  "missing",
  "is",
  "has",
  "should",
  "error",
  "errors",
  "message",
  "prefix",
  "suffix",
  "last4",
  "id",
  // What a token says about its holder, as in Spring's `token.getPrincipal()`.
  "principal",
  "subject",
  "issuer",
  "audience",
  "scope",
  "scopes",
  "claims"
]);
var commentLine3 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var sourceFile = /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|java|kt|scala|cs|php)$/i;
var maxLineLength2 = 1e3;
function findSecretLogLines(path2, patch) {
  if (!sourceFile.test(path2) || /\.d\.[cm]?ts$/i.test(path2)) {
    return [];
  }
  return patchLines(patch).flatMap(
    ({ line, content, added }) => added && !commentLine3.test(content) && content.length <= maxLineLength2 && logsSecret(content) ? [line] : []
  );
}
function logsSecret(content) {
  const call = logCall.exec(content);
  if (call === null) {
    return false;
  }
  return codeOutsideText(content.slice(call.index + call[0].length)).split(/[^A-Za-z0-9_$.]+/).map((chain) => chain.split(".").filter(Boolean)).some((names2) => {
    const secret = names2.findIndex(isSecretName);
    return secret !== -1 && !names2.slice(secret + 1).some((name) => describes(name) || maskingCall.test(name));
  });
}
var maskingCall = /^(?:slice|substring|substr|mask|redact|hash|digest|toMasked|last4)$/i;
function describes(name) {
  return wordsOf(name).some((word2) => describingWords.has(word2));
}
function codeOutsideText(text) {
  return text.replace(/([fF]?)(["'`])((?:\\.|(?!\2)[^\\])*)\2/g, (_literal, prefix, quote, body) => {
    const inserted2 = [
      ...body.matchAll(quote === "`" ? /\$\{([^}]*)\}/g : prefix !== "" ? /\{([^}]*)\}/g : /#\{([^}]*)\}/g)
    ].map((match2) => match2[1] ?? "");
    return ` ${inserted2.join(" ")} `;
  });
}
function wordsOf(name) {
  return name.split(/_|\$/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)).filter(Boolean).map((word2) => word2.toLowerCase());
}
function isSecretName(name) {
  const words = wordsOf(name);
  if (words.some((word2) => describingWords.has(word2))) {
    return false;
  }
  return words.some((word2) => secretWords.has(word2)) || secretPairs.some(([first, second]) => words.some((word2, index) => word2 === first && words[index + 1] === second));
}

// src/rules/secret-logging.ts
var documentation2 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var secretLoggingRule = {
  id: "secret-logging",
  description: "Flags log and console calls that write a password, token, API key, or other secret.",
  run({ files, config: config2 }) {
    if (!config2.rules.secretLogging.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (documentation2.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = secretLogLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "secret-logging",
          title: "Secret written to a log",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write" : "writes"} what looks like a password, token, or key to a log or the console, where anyone who can read the logs, or a log service, can see it.`,
          recommendation: "Log that the value was present or an identifier for it, never the value itself, or mask it first, for example by keeping its last four characters. Logging libraries can also redact known fields, such as pino's redact option."
        }
      ];
    });
  }
};
function secretLogLines(file) {
  if (file.secretLogLines !== void 0) {
    return file.secretLogLines;
  }
  return file.patch === void 0 ? [] : findSecretLogLines(file.path, file.patch);
}

// src/security/credential-formats.ts
var credentialFormats = [
  { kind: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "AWS access key ID", pattern: /\bAKIA[0-9A-Z]{16}\b/g }
];
function isAllowlisted(candidate, allowlist2) {
  return allowlist2.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(candidate);
  });
}

// src/security/url-credentials.ts
var urlWithPassword = /\b[a-z][\w+.-]*:\/\/([^\s:@/'"`]*):([^\s@/'"`]+)@(\[[^\]\s]*\]|[^\s:/?#'"`]+)/gi;
var template = /[${}<>]|%(?:s|\(|\{)|^\*/;
var examplePassword = /^(?:pass(?:word)?\d*|passw0rd|pwd|passwd|secret\d*|mysecretpassword|s3cr3t|p@ss(?:word)?|pa\$\$word|foo|bar|baz|qux|user|username|letmein|tiger\S*|a secret|redacted|hidden|masked|xxx+|\*+|\.{3}|…)$/i;
var exampleHost = /(?:^|\.)(?:example\.(?:com|org|net)|example|test|invalid|localhost)$|^(?:host|hostname|server|domain|your[\w-]*|my[\w-]*host|db-host|server-name)$/i;
var minPasswordLength = 4;
var commentLine4 = /^\s*(?:#|\/\/|\/\*|\*|--|;)/;
var maxLineLength3 = 2e3;
function findUrlCredentialLines(path2, patch, allowlist2 = []) {
  if (credentialFileKind(path2) !== void 0) {
    return [];
  }
  return addedLines(patch).filter(({ content }) => content.length <= maxLineLength3 && content.includes("://") && !commentLine4.test(content) && hasUrlPassword(content, allowlist2)).map(({ line }) => line);
}
function redactUrlPasswords(text, redaction2, allowed) {
  if (!text.includes("://")) {
    return text;
  }
  return text.replace(urlWithPassword, (match2, user, password, host) => {
    if (isExample(user, password, host) || allowed(password)) {
      return match2;
    }
    const start = match2.indexOf("://") + 3 + user.length + 1;
    return `${match2.slice(0, start)}${redaction2}${match2.slice(start + password.length)}`;
  });
}
function hasUrlPassword(content, allowlist2 = []) {
  for (const [, user = "", password = "", host = ""] of content.matchAll(urlWithPassword)) {
    if (!isExample(user, password, host) && !isAllowlisted(password, allowlist2)) {
      return true;
    }
  }
  return false;
}
function isExample(user, password, host) {
  const decoded = safeDecode2(password);
  return template.test(password) || decoded.length < minPasswordLength || isPlaceholder(decoded) || examplePassword.test(decoded) || decoded === user || localHost.test(host) || exampleHost.test(host);
}
function safeDecode2(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// src/rules/url-credentials.ts
var documentation3 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var urlCredentialsRule = {
  id: "url-credentials",
  seesIgnoredFiles: true,
  description: "Flags URLs with a password in them, such as database connection strings.",
  run({ files, config: config2 }) {
    if (!config2.rules.urlCredentials.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    const allowlist2 = config2.security.redaction.allowlist.map((source) => new RegExp(source));
    return files.flatMap((file) => {
      if (documentation3.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = urlCredentialLines(file, allowlist2);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "url-credentials",
          title: "Password in a URL",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "add URLs" : "adds a URL"} with a password in ${plural ? "them" : "it"}, such as a database connection string, so anyone who can read the repository can use ${plural ? "those passwords" : "the password"}. ${plural ? "The passwords are" : "The password is"} redacted from this review.`,
          recommendation: "Treat the password as exposed: change it, and build the URL at run time from an environment variable or a secret store, such as `DATABASE_URL`. If it is a known test value, add a pattern for it to security.redaction.allowlist."
        }
      ];
    });
  }
};
function urlCredentialLines(file, allowlist2) {
  if (file.urlCredentialLines !== void 0) {
    return file.urlCredentialLines;
  }
  return file.patch === void 0 ? [] : findUrlCredentialLines(file.path, file.patch, allowlist2);
}

// src/rules/unescaped-html.ts
var htmlTemplates = /\.(?:html?|jinja2?|j2|njk|nunjucks|twig|djhtml|liquid)$/i;
var scripts = /\.(?:[cm]?[jt]sx?|vue)$/i;
var forms = [
  // Vue, in single-file components, HTML, and templates written in script files.
  { label: "v-html", files: /\.(?:vue|html?|[cm]?[jt]sx?)$/i, pattern: /\bv-html\s*=\s*(["'])(?<expr>(?:(?!\1).)*)\1/g },
  { label: "{@html}", files: /\.svelte$/i, pattern: /\{@html\s+(?<expr>[^}]*)\}/g },
  // Angular sanitizes [innerHTML] by default; these calls turn that off for one value.
  {
    label: "bypassSecurityTrust",
    files: scripts,
    pattern: /\.bypassSecurityTrust(?:Html|Script|Style|Url|ResourceUrl)\s*\(\s*(?<expr>[^)]*)/g
  },
  // Jinja, Django, and Nunjucks `|safe`, and Twig's `|raw`. Django forms' help text is written by the
  // developer, and filters such as `tojson` already escape the value.
  {
    label: "|safe or |raw",
    files: htmlTemplates,
    pattern: /\{\{-?\s*(?<expr>[^{}]*?)\s*\|\s*(?:safe|raw)\b[^{}]*\}\}/g,
    skip: /(?:^|\.)help_text$|\|\s*(?:tojson|json_script|escapejs|escape|e|urlencode|striptags|json_encode)\b/
  },
  { label: "autoescape off", files: htmlTemplates, pattern: /\{%-?\s*autoescape\s+(?:off|false)\b/g },
  // Handlebars and Mustache. `{{{body}}}` is where express-handlebars puts the rendered page.
  {
    label: "triple-stash",
    files: /\.(?:hbs|handlebars|mustache|html?)$/i,
    pattern: /\{\{\{\s*(?<expr>[^{}]*?)\s*\}\}\}|\{\{&\s*(?<expr2>[^{}]*?)\s*\}\}/g,
    skip: /^(?:body|yield|outlet)$/
  },
  // EJS's `<%-` writes without escaping; `<%- include(...) %>` adds another template.
  { label: "<%-", files: /(?<!\.(?:[cm]?[jt]sx?|json|ya?ml|sh|css|md|txt|py|toml|env))\.ejs$/i, pattern: /<%-\s*(?<expr>(?:(?!%>).)*?)\s*-?%>/g, skip: /^include\b/ },
  { label: "{!! !!}", files: /\.blade\.php$/i, pattern: /\{!!\s*(?<expr>(?:(?!!!\}).)*?)\s*!!\}/g },
  { label: "<%==", files: /\.erb$/i, pattern: /<%==\s*(?<expr>(?:(?!%>).)*?)\s*-?%>/g },
  // Haml's `!=`, Slim's `==`, and Pug's `!=` and `!{...}`. Lines starting with `-` are code.
  { label: "!=", files: /\.haml$/i, pattern: /^\s*(?:[%.#][\w.#-]*(?:\{[^}]*\}|\([^)]*\))?)?\s*!=\s*(?<expr>.+)$/g },
  { label: "==", files: /\.slim$/i, pattern: /^\s*(?:[a-z][\w.#-]*)?\s*==\s*(?<expr>.+)$/gi },
  {
    label: "!= or !{}",
    files: /\.(?:pug|jade)$/i,
    pattern: /^\s*(?:[\w.#-]*\w(?:\([^)]*\))?)?!=\s*(?<expr>.+)$|!\{(?<expr2>[^}]*)\}/g
  },
  // Thymeleaf. `#{...}` reads a message from the application's own message files.
  { label: "th:utext", files: /\.html?$/i, pattern: /\bth:utext\s*=\s*(["'])(?<expr>(?:(?!\1).)*)\1/g, skip: /^#\{/ },
  { label: 'escapeXml="false"', files: /\.(?:jspx?|tag)$/i, pattern: /<c:out\b[^>]*\bescapeXml\s*=\s*["']false["']/g },
  // Python: Django's mark_safe and SafeString, MarkupSafe's Markup, and Jinja without autoescaping.
  // `Markup("<b>%s</b>") % value` escapes the value, so only what is inside the call is checked.
  { label: "mark_safe or Markup", files: /\.py$/i, pattern: /(?<![.\w])(?:mark_safe|SafeString|Markup)\s*\(\s*(?<expr>[^)]*)/g },
  { label: "autoescape=False", files: /\.py$/i, pattern: /\bautoescape\s*=\s*False\b/g }
];
var literalParts = /(["'])(?:\\.|(?!\1).)*\1|\b(?:_|gettext\w*|ugettext\w*|pgettext\w*|ngettext\w*|trans|__)\b|[()+,\s]|^\d+$/g;
var quoted = /["']/;
var reviewed = /#\s*nosec\b|nosemgrep/;
var commentLine5 = /^\s*(?:<!--|\{#|\{\{!|\/\/|#(?!\{)|\*|\/\*|-#|\/[^/])/;
var documentation4 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$|(?:^|\/)docs?\//i;
var maxLineLength4 = 2e3;
var unescapedHtmlRule = {
  id: "unescaped-html",
  description: "Flags template output and calls that write a value into HTML without escaping it.",
  run({ files, config: config2 }) {
    if (!config2.rules.unescapedHtml.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation4.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const fileForms = forms.filter((form) => form.files.test(file.path));
      if (fileForms.length === 0) {
        return [];
      }
      const found = addedLines(file.patch).flatMap(
        ({ line, content }) => content.length > maxLineLength4 || commentLine5.test(content) || reviewed.test(content) ? [] : fileForms.filter((form) => writesValue(form, content)).map((form) => ({ line, label: form.label }))
      );
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = [...new Set(found.map((match2) => match2.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "unescaped-html",
          title: "HTML written without escaping",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} into the page without HTML escaping (${kinds3.join(", ")}), so a value that holds user input can run scripts in the page (cross-site scripting).`,
          recommendation: "Let the template escape the value. When it must hold HTML, sanitize it first with a library such as DOMPurify, sanitize-html, bleach, or nh3, and mark only the sanitized result as safe."
        }
      ];
    });
  }
};
function writesValue(form, content) {
  form.pattern.lastIndex = 0;
  for (const match2 of content.matchAll(form.pattern)) {
    const groups = match2.groups ?? {};
    const expr = (groups.expr ?? groups.expr2)?.trim();
    if (expr === void 0 && !("expr" in groups)) {
      return true;
    }
    if (expr === void 0 || expr === "" || isWrittenText(expr) || form.skip?.test(expr)) {
      continue;
    }
    return true;
  }
  return false;
}
function isWrittenText(expr) {
  return quoted.test(expr) && expr.replace(literalParts, "") === "";
}

// src/security/timing-compare.ts
var secretWords2 = /* @__PURE__ */ new Set(["signature", "sig", "hmac", "token", "secret", "apikey", "csrf", "otp"]);
var secretPairs2 = [
  ["api", "key"],
  ["access", "key"],
  ["secret", "key"],
  ["auth", "key"]
];
var otherWords = /* @__PURE__ */ new Set([
  "length",
  "len",
  "size",
  "count",
  "type",
  "types",
  "kind",
  "name",
  "id",
  "index",
  "idx",
  "value",
  "text",
  "raw",
  "given",
  "start",
  "end",
  "line",
  "col",
  "column",
  "pos",
  "position",
  "offset",
  "range",
  "loc",
  "location",
  "char",
  "next",
  "current",
  "cur",
  "prev",
  "previous",
  "last",
  "first",
  "peek",
  "lookahead",
  "eof",
  "page",
  "cursor",
  "continuation",
  "pagination",
  "cancellation",
  "cancel",
  "sync",
  "resume",
  "lexer",
  "parser",
  "syntax",
  "ast",
  "tokenizer",
  "expires",
  "expiry",
  "expiration",
  "ttl",
  "header",
  "prefix",
  "is",
  "has",
  "should",
  "valid",
  "enabled",
  "required",
  "present",
  "exists",
  "missing",
  "error",
  "errors",
  "status",
  "state",
  "ttype",
  "contents",
  "content",
  "method",
  "endpoint",
  "username",
  "user",
  "account",
  "identity",
  "model",
  "uuid",
  "lookup",
  "age",
  "max",
  "min",
  "term",
  "data",
  "class",
  "pointer",
  "ptr",
  "split",
  "strip",
  "lower",
  "upper",
  "omit",
  "verify",
  "verified",
  "algorithm",
  "alg",
  "use",
  "hash",
  "digest",
  "sub",
  "iss",
  "aud",
  "exp",
  "iat",
  "nbf",
  "scope",
  "claims"
]);
var aboutWords = /* @__PURE__ */ new Set(["type", "types", "kind", "class", "name", "length", "len", "size", "count", "id", "ttype", "username", "user", "method", "data"]);
var wrappers = /* @__PURE__ */ new Set(["len", "length", "size", "count", "typeof", "type", "sizeof", "strlen", "cap", "isinstance", "bool", "hash", "stringify"]);
var secretConstant = /(?:^|_)(?:SECRET|API_?KEY|SECRET_?KEY|AUTH_?TOKEN|ACCESS_?TOKEN|API_?TOKEN)$/;
var constant = /^_?[A-Z][A-Z0-9_]*$/;
var sameObject = /^(?:this|that|other|self|o|obj|rhs|lhs)$/;
var requestNames = /* @__PURE__ */ new Set(["req", "request", "params", "param", "query", "body", "headers", "header", "cookies", "cookie", "ctx", "args", "form", "input", "payload"]);
var member = /^[\w$]+\s*(?:\??\.|\[)/;
var generatedSide = /^(?:module\.)?exports\b|^\$\[\d+\]$/;
var testValue = /^(?:mock|fake|dummy|stub|test)(?:[A-Z_]|$)/;
var languageTooling = /(?:^|[/_.-])(?:lexer|lex|parser|parse|compiler|tokenizer|tokenize|scanner|grammar|formatter|syntax|ast)(?:[/_.-]|s\/|$)/i;
var equality = /(?<![=!<>])(?:===|!==|==|!=)(?!=)/g;
var chainBefore = /([\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\s*$/;
var chainAfter = /^\s*([\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)/;
var equalityCalls = [
  /([\w$]+(?:\??\.[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\.(?:equals|Equals|contentEquals|SequenceEqual)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
  /\b(?:bytes\.Equal|strcmp|Arrays\.equals|Objects\.equals)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g
];
var insertingText = /^\s*(?:`[^`]*\$\{|[fF]["'])/;
var literal = /^\s*(?:[bBrRuU]{0,2}["']|`(?![^`]*\$\{)|-?\d|(?:null|undefined|None|nil|NULL|nullptr|true|false|True|False|void)\b|\[\s*\]|\{\s*\}|$)/;
var reviewed2 = /#\s*nosec\b|nosemgrep/;
var constantTime = /timingSafeEqual|compare_digest|secure_compare|hash_equals|ConstantTimeCompare|MessageDigest\.isEqual|FixedTimeEquals|constant_?time/i;
var commentLine6 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var pascalCaseConstants = /\.(?:go|py)$/i;
var sourceFile2 = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
var skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength5 = 1e3;
function findTimingCompareLines(path2, patch) {
  if (!sourceFile2.test(path2) || skippedFile.test(path2) || languageTooling.test(path2)) {
    return [];
  }
  return patchLines(patch).flatMap(
    ({ line, content, added }) => added && content.length <= maxLineLength5 && !commentLine6.test(content) && !constantTime.test(content) && !reviewed2.test(content) && comparesSecret(content, pascalCaseConstants.test(path2)) ? [line] : []
  );
}
function comparesSecret(content, pascalCase) {
  const pairs = [];
  for (const match2 of content.matchAll(equality)) {
    const left = chainBefore.exec(content.slice(0, match2.index))?.[1];
    const rest = content.slice(match2.index + match2[0].length);
    const right = insertingText.test(rest) ? "inserted" : chainAfter.exec(rest)?.[1];
    if (left !== void 0 && right !== void 0 && !literal.test(rest)) {
      pairs.push([left, right]);
    }
  }
  const [method, call] = equalityCalls;
  for (const match2 of content.matchAll(method ?? /$^/)) {
    pairs.push([match2[1] ?? "", match2[2] ?? ""]);
  }
  for (const match2 of content.matchAll(call ?? /$^/)) {
    const args = (match2[1] ?? "").split(",");
    if (args.length === 2) {
      pairs.push([args[0] ?? "", args[1] ?? ""]);
    }
  }
  return pairs.some(([left, right]) => comparesSecretPair(left.trim().replace(/->/g, "."), right.trim().replace(/->/g, "."), pascalCase));
}
function comparesSecretPair(left, right, pascalCase) {
  if ([left, right].some(
    (side) => literal.test(side) || isFixedValue(side, pascalCase) || generatedSide.test(side) || testValue.test(namesOf(side)[0] ?? "")
  )) {
    return false;
  }
  const [leftNames, rightNames] = [namesOf(left), namesOf(right)];
  const fromObject = (chain, names2) => names2.length > 1 || /\)\s*$/.test(chain);
  if (fromObject(left, leftNames) && fromObject(right, rightNames) && (lastName(left) === lastName(right) || fieldOf(left) !== void 0 && fieldOf(left) === fieldOf(right)) && ([leftNames[0], rightNames[0]].some((name) => name !== void 0 && sameObject.test(name)) || // Members of objects, not one function applied to two values, as in `_hmac(key, a) != _hmac(key, b)`.
  [left, right].every((side) => member.test(side)) && ![...leftNames, ...rightNames].some((name) => requestNames.has(name.toLowerCase()) || name.startsWith("$_")))) {
    return false;
  }
  const [leftSecret, rightSecret] = [isSecret(left), isSecret(right)];
  if (leftSecret && !rightSecret && isAbout(right) || rightSecret && !leftSecret && isAbout(left)) {
    return false;
  }
  return leftSecret || rightSecret;
}
function isFixedValue(chain, pascalCase) {
  const last = lastName(chain);
  const first = namesOf(chain)[0] ?? "";
  if (constant.test(last) && last.length > 1) {
    return !secretConstant.test(last);
  }
  const call = /\)\s*$/.test(chain);
  return !call && /^[A-Z]/.test(last) && (pascalCase || /^[A-Z]/.test(first));
}
function fieldOf(chain) {
  return /\(\s*["']([\w-]+)["']\s*\)\s*$/.exec(chain)?.[1];
}
function isAbout(chain) {
  return namesOf(chain).some((name) => wordsOf2(name).some((word2) => aboutWords.has(word2)));
}
function namesOf(chain) {
  return chain.split(/[.[\]()'"?,:\s]+/).filter(Boolean);
}
function lastName(chain) {
  const key = /\[\s*:?["']?([\w-]+)["']?\s*\]\s*$/.exec(chain);
  if (key !== null && /\[\s*(?:["']|:)/.test(chain.slice(key.index))) {
    return key[1] ?? "";
  }
  const stripped = chain.replace(/(?:\([^()]*\)|\[[^[\]]*\])+\s*$/, "");
  return stripped.slice(stripped.lastIndexOf(".") + 1).replace(/^\?/, "");
}
function isSecret(chain) {
  const names2 = namesOf(chain);
  const secret = names2.findIndex(isSecretName2);
  return secret !== -1 && // A numeric index, as in `token[1]`, reads one part of a lexer's tuple.
  !names2.slice(secret + 1).some((name) => /^\d+$/.test(name) || wordsOf2(name).some((word2) => otherWords.has(word2))) && !names2.slice(0, secret).some((name) => wrappers.has(name.toLowerCase()));
}
function isSecretName2(name) {
  const words = wordsOf2(name);
  if (words.some((word2) => otherWords.has(word2))) {
    return false;
  }
  return words.some((word2) => secretWords2.has(word2)) || secretPairs2.some(([first, second]) => words.some((word2, index) => word2 === first && words[index + 1] === second));
}
function wordsOf2(name) {
  return name.split(/[_$-]/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)).filter(Boolean).map((word2) => word2.toLowerCase());
}

// src/rules/timing-unsafe-comparison.ts
var timingUnsafeComparisonRule = {
  id: "timing-unsafe-comparison",
  description: "Flags signatures, tokens, and keys compared with an operator that stops at the first difference.",
  run({ files, config: config2 }) {
    if (!config2.rules.timingUnsafeComparison.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = timingCompareLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "timing-unsafe-comparison",
          title: "Secret compared in variable time",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compare" : "compares"} what looks like a signature, token, or key with an operator that stops at the first difference, so how long the check takes can reveal the expected value one character at a time.`,
          recommendation: "Compare secrets in constant time: crypto.timingSafeEqual in Node.js, hmac.compare_digest in Python, ActiveSupport::SecurityUtils.secure_compare in Ruby, subtle.ConstantTimeCompare in Go, MessageDigest.isEqual in Java, CryptographicOperations.FixedTimeEquals in .NET, or hash_equals in PHP."
        }
      ];
    });
  }
};
function timingCompareLines(file) {
  if (file.timingCompareLines !== void 0) {
    return file.timingCompareLines;
  }
  return file.patch === void 0 ? [] : findTimingCompareLines(file.path, file.patch);
}

// src/rules/postmessage-origin.ts
var labels = {
  wildcard: "sends a message to any origin with `*`, so the data reaches whatever page is loaded in that window",
  listener: "listens for messages from other windows without checking `event.origin`, so any website that can open or frame this page can send it commands"
};
var wildcardTarget = /(?<!(?:^|[^\w$.])(?:window|self|globalThis|global|_global|this))\.postMessage\s*\((?:[^()]|\([^()]*\))*?,\s*(?:["'`]\*["'`]|\{[^}]*\btargetOrigin\s*:\s*["'`]\*["'`])/;
var windowListener = /\b(?:window|globalThis|top|parent)\.addEventListener\s*\(\s*["'`]message["'`]\s*,\s*(.*)$|^\s*(?:export\s+)?(?:\w+\s*\(\s*)?addEventListener\s*\(\s*["'`]message["'`]\s*,\s*(.*)$|\b(?:window|globalThis)\.onmessage\s*=\s*(.*)$/;
var handlerName = /^\s*([A-Za-z_$#][\w$.#]*)\s*[,)]/;
var checksSender = /\borigin\b|\.source\s*[!=]==?|[!=]==?\s*[\w$.]*\.source\b|isTrusted|allowedOrigins?|trustedOrigins?|\b(?:sanitize|validate|verify|check|isValid|isAllowed|isTrusted)\w*\s*\(\s*(?:e|ev|evt|event|msg|message)\b/i;
var bodyReach = 25;
var browserFile = /\.(?:[cm]?[jt]sx?|vue|svelte|html?)$/i;
var workerFile = /(?:^|[/._-])(?:worker|sw|service-worker|serviceworker)(?:[/._-]|$)/i;
var skippedFile2 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var commentLine7 = /^\s*(?:\/\/|\/\*|\*)/;
var maxLineLength6 = 1e3;
var postMessageOriginRule = {
  id: "postmessage-origin",
  description: "Flags postMessage calls to any origin and window message listeners that do not check the sender's origin.",
  run({ files, config: config2 }) {
    if (!config2.rules.postMessageOrigin.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !browserFile.test(file.path) || skippedFile2.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findIssues(file.patch, workerFile.test(file.path));
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = Object.keys(labels).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "postmessage-origin",
          title: "Cross-window message without an origin check",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${kinds3.map((kind) => plural ? labels[kind].replace(/^(\w+)s /, "$1 ") : labels[kind]).join(", and ")}.`,
          recommendation: 'Send messages to the exact origin of the receiving page, such as `postMessage(data, "https://app.example.com")`, and start every message handler by comparing `event.origin` with the origins it trusts, ignoring anything else.'
        }
      ];
    });
  }
};
function findIssues(patch, worker) {
  const lines = patchLines(patch);
  return lines.flatMap((current, index) => {
    const { line, content, added } = current;
    if (!added || content.length > maxLineLength6 || commentLine7.test(content)) {
      return [];
    }
    const issues = [];
    if (wildcardTarget.test(content)) {
      issues.push({ line, kind: "wildcard" });
    }
    const listener = windowListener.exec(content);
    if (listener !== null) {
      const bare = listener[2] !== void 0;
      const handler = listener[1] ?? listener[2] ?? listener[3] ?? "";
      if (!(bare && worker) && !handlerChecksSender(handler, lines, index)) {
        issues.push({ line, kind: "listener" });
      }
    }
    return issues;
  });
}
function handlerChecksSender(handler, lines, index) {
  const named = handlerName.exec(handler)?.[1];
  if (named !== void 0 && !/^(?:function|async)$/.test(named)) {
    const name = named.slice(named.lastIndexOf(".") + 1).replace(/[$]/g, "\\$&");
    const definition2 = new RegExp(
      `(?:function\\s*\\*?\\s*${name}\\s*\\(|(?<![\\w$#])${name}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\(?[\\w$,\\s{}]*\\)?\\s*=>)|^\\s*(?:(?:private|public|protected|static|async)\\s+)*${name}\\s*\\([^)]*\\)\\s*(?::[^{]*)?\\{)`
    );
    const matches = lines.flatMap(({ content }, at) => definition2.test(content) ? [at] : []);
    const start = matches.filter((at) => at < index).at(-1) ?? matches.find((at) => at > index) ?? -1;
    return start === -1 || readsSender(lines, start);
  }
  return readsSender(lines, index);
}
function readsSender(lines, start) {
  const first = lines[start];
  if (first === void 0) {
    return true;
  }
  return lines.slice(start, start + bodyReach).some(({ line, content }) => line - first.line < bodyReach && checksSender.test(content));
}

// src/rules/nosql-injection.ts
var labels2 = {
  filter: 'puts a value from the request into a MongoDB filter, where an object such as `{"$ne": null}` matches any document',
  where: "builds a MongoDB `$where` expression from text, which runs as JavaScript on the database"
};
var languages2 = [
  {
    // Mongoose models and MongoDB collections. `findById` casts its argument, and arrays' `find` takes
    // a function, not a filter.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    query: /\.(?:find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|findOneAndRemove|updateOne|updateMany|deleteOne|deleteMany|replaceOne|countDocuments|count|exists|distinct|where)\s*\(\s*(?=[{\w])/g,
    // Express and Koa parse `a[$ne]=1` in a query string, and JSON bodies, into objects. Route
    // parameters are always text.
    request: /\b(?:req|request|ctx(?:\.request)?)\.(?:body|query)\b/,
    guard: /\bString\s*\(|\.toString\s*\(|\bNumber\s*\(|\bparseInt\s*\(|\bparseFloat\s*\(|\bBoolean\s*\(|ObjectId\s*\(|\bsanitize\w*\s*\(|\$eq\s*:|`[^`]*\$\{[^}]*(?:req|request|ctx)/
  },
  {
    // PyMongo and Motor. Flask's `request.args` and `request.form` hold text; JSON bodies hold objects.
    files: /\.py$/i,
    query: /\.(?:find|find_one|find_one_and_update|find_one_and_delete|find_one_and_replace|update_one|update_many|delete_one|delete_many|replace_one|count_documents|distinct)\s*\(\s*(?=[{\w])/g,
    request: /\brequest\.(?:json\b|data\b|body\b|get_json\s*\()|\bjson\.loads\s*\(\s*request\b/,
    guard: /\bstr\s*\(|\bint\s*\(|\bfloat\s*\(|\bbool\s*\(|ObjectId\s*\(|\$eq["']?\s*:/
  },
  {
    // The MongoDB PHP library. `a[$ne]=1` arrives as an array.
    files: /\.php$/i,
    query: /->(?:find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|updateOne|updateMany|deleteOne|deleteMany|replaceOne|countDocuments|count|distinct)\s*\(\s*(?=[[\w$])/g,
    request: /\$_(?:GET|POST|REQUEST|COOKIE)\b|\$request->(?:input|get|query|post|all)\s*\(/,
    guard: /\(\s*string\s*\)|\bstrval\s*\(|\(\s*int\s*\)|\bintval\s*\(|ObjectId\s*\(|\$eq['"]?\s*=>/
  }
];
var whereExpression = /["']?\$where["']?\s*(?::|=>)\s*(?:`[^`]*\$\{|f["']|["'][^"']*["']\s*(?:\+|\.)|\w[\w.]*\s*\+)/;
var destructuring = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?((?:req|request|ctx(?:\.request)?)\.(?:body|query))\b/;
var requestObject = /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:(?:req|request|ctx(?:\.request)?)\.(?:body|query)|request\.(?:json|get_json\s*\(\s*\))|json\.loads\s*\(\s*request\b)\s*;?\s*$/;
var parsers = /^(?:JSON|EJSON|qs|querystring|json|bson)\.(?:parse|loads|load)$/;
var serviceReceiver = /(?:\b(?:service|repository)|[\w$]Service|[\w$]Repository)(?:\s*\([^()]*\))?\s*$/;
var sqlOrmFilter = /^\s*\{\s*where\s*:/;
var filterReach = 12;
var commentLine8 = /^\s*(?:#|\/\/|\/\*|\*)/;
var skippedFile3 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength7 = 1e3;
var nosqlInjectionRule = {
  id: "nosql-injection",
  description: "Flags request values used as MongoDB filters without a cast to text, and $where expressions built from text.",
  run({ files, config: config2 }) {
    if (!config2.rules.nosqlInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages2.find((candidate) => candidate.files.test(file.path));
      if (language === void 0 || file.patch === void 0 || skippedFile3.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findIssues2(patchLines(file.patch), language);
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = Object.keys(labels2).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "nosql-injection",
          title: "Request value in a MongoDB query",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${kinds3.map((kind) => plural ? labels2[kind].replace(/^(\w+)s /, "$1 ") : labels2[kind]).join(", and ")}.`,
          recommendation: 'Turn each request value into the type the query expects before using it, such as `String(req.body.email)` or `str(data["email"])`, or match it with `$eq`. Validate request bodies with a schema, enable Mongoose\'s `sanitizeFilter`, or strip `$` keys with a package such as express-mongo-sanitize. Never build `$where` from text; use query operators instead.'
        }
      ];
    });
  }
};
function findIssues2(lines, language) {
  const requestNames2 = /* @__PURE__ */ new Set();
  const requestObjects = /* @__PURE__ */ new Set();
  const issues = [];
  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength7 || commentLine8.test(content)) {
      return;
    }
    const object2 = requestObject.exec(content)?.[1];
    if (object2 !== void 0) {
      requestObjects.add(object2);
    }
    const names2 = destructuring.exec(content);
    if (names2 !== null) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0 && !part.includes("...")) {
          requestNames2.add(name);
        }
      }
    }
    if (!added) {
      return;
    }
    if (whereExpression.test(content)) {
      issues.push({ line, kind: "where" });
    }
    language.query.lastIndex = 0;
    for (const match2 of content.matchAll(language.query)) {
      if (serviceReceiver.test(content.slice(0, match2.index))) {
        continue;
      }
      const filter2 = filterText(lines, index, match2.index + match2[0].length);
      if (filterUsesRequest(filter2, language, requestNames2, requestObjects)) {
        issues.push({ line, kind: "filter" });
        break;
      }
    }
  });
  return issues;
}
function filterText(lines, index, start) {
  const first = lines[index]?.content.slice(start) ?? "";
  let depth = 0;
  let text = "";
  for (const [offset, content] of [first, ...lines.slice(index + 1, index + filterReach).map((line) => line.content)].entries()) {
    for (const char of content) {
      if ("{[(".includes(char)) {
        depth += 1;
      } else if ("}])".includes(char)) {
        depth -= 1;
        if (depth < 0) {
          return text;
        }
      } else if (char === "," && depth === 0) {
        return text;
      }
      text += char;
    }
    text += "\n";
    if (offset === 0 && depth === 0) {
      return text;
    }
  }
  return text;
}
function filterUsesRequest(filter2, language, requestNames2, requestObjects) {
  if (sqlOrmFilter.test(filter2)) {
    return false;
  }
  if (new RegExp(`^\\s*(?:${language.request.source})\\s*$`).test(filter2)) {
    return true;
  }
  return filter2.split(/,|\n/).some((part) => {
    if (language.guard.test(part)) {
      return false;
    }
    const value = /(?::|=>)\s*(.*)$/s.exec(part)?.[1] ?? part;
    const wrapper = /^\s*([\w$.]+)\s*\(/.exec(value)?.[1];
    const fromRequest = new RegExp(`^\\s*(?:${language.request.source})`).test(value);
    if (wrapper !== void 0 && !fromRequest && !parsers.test(wrapper)) {
      return false;
    }
    if (language.request.test(value) && !/^\s*\{?\s*$/.test(value)) {
      return true;
    }
    const name = /^[\s{]*([A-Za-z_$][\w$]*)[\s}]*$/.exec(value)?.[1];
    if (name !== void 0 && requestNames2.has(name)) {
      return true;
    }
    const object2 = /^[\s{]*([A-Za-z_$][\w$]*)\s*(?:\.(?!length\b)\w|\[|\.get\s*\()/.exec(value)?.[1];
    return object2 !== void 0 && requestObjects.has(object2);
  });
}

// src/rules/untrusted-input.ts
var labels3 = {
  redirect: "redirects to a URL from the request, which can send users to any site",
  ssrf: "requests a URL from the request, which can reach internal services",
  path: "reads or writes a file path from the request, which can leave the intended directory"
};
var requestValue = /\b(?:req|request|ctx(?:\.request)?)\.(?:query|params|body|headers|cookies|url)\b|\brequest\.(?:args|form|values|json|get_json\(|GET|POST|COOKIES|META|FILES|data|query_params)\b|\$_(?:GET|POST|REQUEST|COOKIE|SERVER\[\s*["']HTTP_)|\br\.(?:URL\.Query\(\)|FormValue\(|PostFormValue\(|Header\.Get\()|\bRequest\.(?:Query|Form|Headers|Cookies)\[|\bsearchParams\.get\(/;
var railsParams = /(?<![\w.@])params\[/;
var rubyFile = /\.(?:rb|erb|rake)$/i;
var sinks = [
  [
    "redirect",
    /\b(?:res|reply|ctx|response)\.redirect\s*\(|(?:^|[^\w.])redirect\s*\(|\bHttpResponseRedirect\s*\(|\bheader\s*\(\s*["']Location:|\bhttp\.Redirect\s*\(|\bredirect_to\b(?!\s*=)|\bRedirect(?:Permanent)?\s*\(|\.location(?:\.href)?\s*=/
  ],
  [
    "ssrf",
    /(?:^|[^\w.])fetch\s*\(|\baxios(?:\.(?:get|post|put|patch|delete|head|request))?\s*\(|\bgot(?:\.(?:get|post))?\s*\(|\bhttps?\.(?:get|request)\s*\(|\brequests\.(?:get|post|put|patch|delete|head|request)\s*\(|\burlopen\s*\(|\bhttpx\.(?:get|post|put|delete|request|AsyncClient)\b|\bhttp\.(?:Get|Post|Head|NewRequest(?:WithContext)?)\s*\(|\bcurl_init\s*\(|\bNet::HTTP\.get\b|\bURI\.open\s*\(|\.(?:GetAsync|PostAsync|GetStringAsync)\s*\(/
  ],
  [
    "path",
    /\bfs(?:\.promises)?\.(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync|createWriteStream|appendFile|unlink|unlinkSync|rm|rmSync|readdir|stat)\s*\(|\b(?:res|reply)\.(?:sendFile|download)\s*\(|\bpath\.(?:join|resolve)\s*\(|(?:^|[^\w.])open\s*\(|\bos\.path\.join\s*\(|\bsend_file\s*\(|\b(?:include|require)(?:_once)?\s*\(?\s*\$|\b(?:file_get_contents|fopen|readfile|unlink)\s*\(|\bos\.(?:Open|OpenFile|ReadFile|WriteFile|Remove)\s*\(|\bfilepath\.Join\s*\(|\bhttp\.ServeFile\s*\(|\bFile\.(?:read|open|ReadAllText|ReadAllBytes|Delete)\s*\(|\bsend_file\b/
  ]
];
var guarded = {
  redirect: /\b(?:url_has_allowed_host_and_scheme|is_safe_url|isLocalUrl|IsLocalUrl|LocalRedirect|safeRedirect|allowedHosts?)\b/,
  ssrf: /\b(?:allowedHosts?|isAllowedUrl|ALLOWED_HOSTS)\b/,
  path: /\b(?:path\.basename|basename|secure_filename|filepath\.Base|Path\.GetFileName|File\.basename|sanitize\w*)\s*\(/
};
var fixedTarget = /^\s*\(?\s*(["'`])(?:\/(?![\/$])|https?:\/\/[\w.-]+(?:[:/?]|\1))/;
var commentLine9 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation5 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var untrustedInputRule = {
  id: "untrusted-input",
  description: "Flags request values passed straight to redirects, outgoing requests, and file paths.",
  run({ files, config: config2 }) {
    if (!config2.rules.untrustedInput.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation5.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const ruby5 = rubyFile.test(file.path);
      const fromRequest = (content) => requestValue.test(content) || ruby5 && railsParams.test(content);
      const found = patchLines(file.patch).flatMap(
        ({ line, content, added }) => added && !commentLine9.test(content) && fromRequest(content) ? sinks.filter(([kind, sink]) => reaches(content, kind, sink)).map(([kind]) => ({ line, kind })) : []
      );
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels3).filter((kind) => found.some((match2) => match2.kind === kind));
      const lines = [...new Set(found.map((match2) => match2.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "untrusted-input",
          title: "Request input used unchecked",
          severity: "warning",
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "pass" : "passes"} a value from the request straight to code that ${joinLabels(listed.map((kind) => labels3[kind]))}.`,
          recommendation: "Check the value against a list of allowed hosts, paths, or redirect targets first. Redirect only to relative paths on your own site, fetch only hosts you expect, and reduce file names with a function such as path.basename before joining them to a directory."
        }
      ];
    });
  }
};
function reaches(content, kind, sink) {
  const match2 = sink.exec(content);
  if (match2 === null || guarded[kind].test(content)) {
    return false;
  }
  return kind === "path" || !fixedTarget.test(content.slice(match2.index + match2[0].length));
}
function joinLabels(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/rules/template-injection.ts
var python = /\.py$/i;
var javascript = /\.(?:[cm]?[jt]sx?)$/i;
var ruby = /\.(?:rb|erb|rake)$/i;
var sinks2 = [
  // Flask, Jinja, Django, and Mako. `string.Template` only substitutes values and runs no code.
  { label: "render_template_string", files: python, call: /\brender_template_string\s*\(/g, argument: 0 },
  { label: "Template", files: python, call: /(?<![.\w])(?:jinja2\.|mako\.template\.)?Template\s*\(/g, argument: 0 },
  { label: "from_string", files: python, call: /\.from_string\s*\(/g, argument: 0 },
  // EJS, Handlebars, Pug, Nunjucks, Lodash, Underscore, and doT.
  {
    label: "template compile",
    files: javascript,
    call: /\b(?:ejs\.(?:render|compile)|Handlebars\.(?:compile|precompile)|handlebars\.(?:compile|precompile)|pug\.(?:render|compile)|jade\.(?:render|compile)|nunjucks\.renderString|_\.template|lodash\.template|doT\.(?:template|compile)|dot\.(?:template|compile))\s*\(/g,
    argument: 0
  },
  { label: "env.renderString", files: javascript, call: /\b\w*[eE]nv\w*\.renderString\s*\(/g, argument: 0 },
  // ERB, Haml, and Slim, and Rails' `render inline:`.
  { label: "ERB.new", files: ruby, call: /\b(?:ERB|Erubi::Engine|Erubis::Eruby|Haml::Engine|Haml::Template|Slim::Template|Tilt::\w+Template)\.new\s*\(/g, argument: 0 },
  { label: "render inline", files: ruby, call: /\brender\s*\(?\s*inline:\s*/g, argument: "inline" },
  // Twig, Blade, and Smarty's `string:` resources.
  { label: "createTemplate", files: /\.php$/i, call: /->createTemplate\s*\(|\bBlade::render\s*\(/g, argument: 0 },
  { label: "Smarty string:", files: /\.php$/i, call: /->(?:fetch|display)\s*\(\s*(?=["'](?:string|eval):)/g, argument: 0 },
  // Velocity evaluates its fourth argument; FreeMarker reads a template from a StringReader.
  { label: "Velocity.evaluate", files: /\.(?:java|kt)$/i, call: /\b(?:Velocity|velocityEngine|engine|ve)\.evaluate\s*\(/g, argument: 3 },
  { label: "FreeMarker Template", files: /\.(?:java|kt)$/i, call: /\bnew\s+Template\s*\([^()]*,\s*new\s+StringReader\s*\(/g, argument: 0 },
  // Go's text/template and html/template.
  { label: "template.Parse", files: /\.go$/i, call: /\btemplate\.(?:New\s*\([^()]*\)\s*(?:\.\w+\([^()]*\)\s*)*|Must\s*\(\s*template\.New\s*\([^()]*\)\s*)\.Parse\s*\(/g, argument: 0 }
];
var servletValue = /\b(?:request|req|httpRequest|servletRequest|httpServletRequest)\.get(?:Parameter|ParameterValues|Header|QueryString|Reader|InputStream)\s*\(/;
var java = /\.(?:java|kt)$/i;
var assignment2 = /^\s*(?:(?:const|let|var|final|String|string)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring2 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach = 30;
var commentLine10 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation6 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var maxLineLength8 = 1e3;
var templateInjectionRule = {
  id: "template-injection",
  description: "Flags templates compiled from text that comes from the request.",
  run({ files, config: config2 }) {
    if (!config2.rules.templateInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks2.filter((sink) => sink.files.test(file.path));
      if (fileSinks.length === 0 || file.patch === void 0 || documentation6.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const isRuby = ruby.test(file.path);
      const isJava = java.test(file.path);
      const fromRequest = (text2) => requestValue.test(text2) || isRuby && railsParams.test(text2) || isJava && servletValue.test(text2);
      const tainted = /* @__PURE__ */ new Map();
      const found = [];
      for (const { line, content, added } of patchLines(file.patch)) {
        if (content.length > maxLineLength8 || commentLine10.test(content)) {
          continue;
        }
        const isTainted = (text2) => fromRequest(text2) || [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text2));
        if (added) {
          for (const sink of fileSinks) {
            sink.call.lastIndex = 0;
            const match2 = sink.call.exec(content);
            if (match2 !== null && isTainted(templateArgument(content.slice(match2.index + match2[0].length), sink.argument))) {
              found.push({ line, label: sink.label });
            }
          }
        }
        const names2 = destructuring2.exec(content);
        if (names2 !== null && fromRequest(names2[2] ?? "")) {
          for (const part of (names2[1] ?? "").split(",")) {
            const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
            if (name !== void 0) {
              tainted.set(name, line);
            }
          }
        }
        const single = assignment2.exec(content);
        if (single !== null && single[1] !== void 0) {
          if (isTainted(single[2] ?? "")) {
            tainted.set(single[1], line);
          } else {
            tainted.delete(single[1]);
          }
        }
      }
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = [...new Set(found.map((match2) => match2.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "template-injection",
          title: "Template built from request input",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compile templates" : "compiles a template"} from text that comes from the request (${kinds3.join(", ")}), so a request can write template code, such as \`{{ ... }}\`, that runs on the server.`,
          recommendation: 'Keep templates in files or fixed strings and pass request values only as variables, such as `render_template("page.html", name=name)` or `ejs.render(template, { name })`. If users must write templates, use a sandboxed, logic-less engine such as Mustache or Liquid.'
        }
      ];
    });
  }
};
function templateArgument(rest, argument) {
  if (argument === "inline") {
    return splitArguments(rest)[0] ?? "";
  }
  return splitArguments(rest)[argument] ?? "";
}
function splitArguments(text) {
  const args = [];
  let depth = 0;
  let quote;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (quote !== void 0) {
      current += char;
      if (char === "\\") {
        current += text[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  args.push(current);
  return args;
}

// src/rules/prototype-pollution.ts
var labels4 = {
  merge: [
    "copies keys recursively without skipping `__proto__`, `constructor`, and `prototype`",
    "copy keys recursively without skipping `__proto__`, `constructor`, and `prototype`"
  ],
  "nested-key": ["assigns through two keys where one comes from the request", "assign through two keys where one comes from the request"]
};
var firstParameter = /\(\s*(?:\{[^}]*\}|\[[^\]]*\]|([A-Za-z_$][\w$]*))/;
var argumentsTarget = /(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*arguments\s*\[\s*0\s*\]/;
var copiedTarget = String.raw`=\s*(?:\{\s*\.\.\.|\[\s*\.\.\.|Object\.assign\s*\(\s*\{\s*\}|structuredClone\s*\(|JSON\.parse\s*\()`;
var copyName = /merge|extend|assign|deep|clone|copy|defaults|mixin|combine|override/i;
var definitions = [
  /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:[\w$.]+\s*=\s*)*(?:async\s+)?(?:function\b[^(]*\(|\([^)]*\)\s*(?::[^=]*)?=>|[A-Za-z_$][\w$]*\s*=>)/,
  /^\s*(?:(?:public|private|protected|static|async|export|default)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::[^{]*)?\{\s*$/
];
var keyLoop = /\bfor\s*\(\s*(?:const|let|var)?\s*[\w$[\]{},\s]+\s+(?:in|of)\s|\bObject\.(?:keys|entries|getOwnPropertyNames)\s*\(|\bReflect\.ownKeys\s*\(/;
var prototypeGuard = /["'`]constructor["'`]|["'`]prototype["'`]|[!=]==?\s*Object\.prototype\b|\bObject\.prototype\s*[!=]==?|is(?:Safe|Unsafe|Dangerous|Forbidden|Valid)(?:Key|Property|Prop)\b|isPrototypePolluted|Object\.create\(\s*null\s*\)|(?:unsafe|forbidden|blocked|dangerous|reserved|special)(?:Keys?|Props?|Properties)\b|(?:Keys|Props|Properties|Names)\.(?:has|includes)\s*\(|new\s+Map\b/i;
var bodyReach2 = 80;
var nestedGuard = new RegExp(`__proto__|${prototypeGuard.source}`, "i");
var nestedAssignment = /\[\s*([^[\]]+?)\s*\]\s*\[\s*([^[\]]+?)\s*\]\s*=(?!=)/;
var assignment3 = /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]|]+\s*)?=(?!=)\s*(.*)$/;
var destructuring3 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach2 = 30;
var sourceFile3 = /\.(?:[cm]?[jt]sx?)$/i;
var skippedFile4 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var commentLine11 = /^\s*(?:\/\/|\/\*|\*)/;
var maxLineLength9 = 1e3;
var prototypePollutionRule = {
  id: "prototype-pollution",
  description: "Flags recursive merges that do not skip prototype keys, and nested assignments through keys from the request.",
  run({ files, config: config2 }) {
    if (!config2.rules.prototypePollution.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !sourceFile3.test(file.path) || skippedFile4.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch).filter(({ content }) => content.length <= maxLineLength9);
      const found = [...unguardedMerges(lines), ...nestedRequestKeys(lines)];
      if (found.length === 0) {
        return [];
      }
      const lineNumbers = [...new Set(found.map((match2) => match2.line))].sort((a, b) => a - b);
      const kinds3 = Object.keys(labels4).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(lineNumbers);
      return [
        {
          ruleId: "prototype-pollution",
          title: "Possible prototype pollution",
          severity: "warning",
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${kinds3.map((kind) => labels4[kind][plural ? 1 : 0]).join(", and ")}, so input such as \`{"__proto__": {"isAdmin": true}}\` can add properties to every object in the process.`,
          recommendation: "Skip the keys `__proto__`, `constructor`, and `prototype` when copying or assigning by key, build lookups with `Object.create(null)` or a `Map`, or use a maintained merge such as lodash's `merge` or `structuredClone`. Validate request bodies against a schema before merging them."
        }
      ];
    });
  }
};
function unguardedMerges(lines) {
  return lines.flatMap(({ line, content, added }, index) => {
    if (!added || commentLine11.test(content)) {
      return [];
    }
    const name = definitions.map((pattern) => pattern.exec(content)?.[1]).find((candidate) => candidate !== void 0);
    if (name === void 0 || !copyName.test(name) || /^(?:if|for|while|switch|catch|function|return)$/.test(name)) {
      return [];
    }
    const body = functionBody(lines, index);
    const target = firstParameter.exec(content.slice(content.indexOf(name) + name.length))?.[1] ?? body.map(({ content: text }) => argumentsTarget.exec(text)?.[1]).find((candidate) => candidate !== void 0);
    if (target === void 0) {
      return [];
    }
    const escaped4 = (text) => text.replace(/\$/g, "\\$");
    const key = String.raw`\[\s*[A-Za-z_$][\w$]*\s*\]`;
    const descends = new RegExp(
      `(?<![\\w$])[\\w$]*(?:${copyName.source})[\\w$]*\\s*\\(\\s*${escaped4(target)}\\s*\\[|(?<![\\w$.])${escaped4(target)}\\s*${key}\\s*=\\s*(?:[\\w$.]+\\.)?${escaped4(name)}\\s*\\(`,
      "i"
    );
    const writes = new RegExp(`(?<![\\w$.])${escaped4(target)}\\s*${key}\\s*=(?!=)`);
    const copied = new RegExp(`(?<![\\w$.])${escaped4(target)}\\s*${copiedTarget}`);
    return body.slice(1).some(({ content: text }) => descends.test(text)) && !body.slice(1).some(({ content: text }) => copied.test(text)) && body.some(({ content: text }) => keyLoop.test(text)) && body.some(({ content: text }) => writes.test(text)) && !body.some(({ content: text }) => prototypeGuard.test(text)) ? [{ line, kind: "merge" }] : [];
  });
}
function functionBody(lines, start) {
  const first = lines[start];
  if (first === void 0) {
    return [];
  }
  const body = [];
  let depth = 0;
  let opened = false;
  for (const current of lines.slice(start, start + bodyReach2)) {
    if (current.line - first.line >= bodyReach2 || current.startsHunk && body.length > 0) {
      break;
    }
    body.push(current);
    for (const char of current.content) {
      if (char === "{") {
        depth += 1;
        opened = true;
      } else if (char === "}") {
        depth -= 1;
      }
    }
    if (opened && depth <= 0) {
      break;
    }
  }
  return body;
}
function nestedRequestKeys(lines) {
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  for (const { line, content, added } of lines) {
    if (commentLine11.test(content)) {
      continue;
    }
    const isTainted = (text) => requestValue.test(text) || [...tainted].some(([name, at]) => line - at <= reach2 && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));
    const nested = nestedAssignment.exec(content);
    if (added && nested !== null && !nestedGuard.test(content) && (isTainted(nested[1] ?? "") || isTainted(nested[2] ?? ""))) {
      found.push({ line, kind: "nested-key" });
    }
    const names2 = destructuring3.exec(content);
    if (names2 !== null && requestValue.test(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment3.exec(content);
    if (single?.[1] !== void 0) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
    if (nestedGuard.test(content)) {
      tainted.clear();
    }
  }
  return found;
}

// src/rules/ldap-xpath-injection.ts
var labels5 = {
  ldap: "an LDAP filter, where a value such as `*)(uid=*` can match every user",
  xpath: "an XPath expression, where a value such as `' or '1'='1` can select every node"
};
var shapes = {
  ldap: /["'`][^"'`]*\(\s*[&|!]?\s*\(?\s*[A-Za-z][\w.-]*\s*[~<>]?=[^"'`]*/,
  xpath: /["'`][^"'`]*(?:\/\/?[\w*@.:-]*\[|\[\s*@?[\w.:-]+\s*=|\[\s*(?:contains|starts-with|text)\s*\()[^"'`]*/
};
var sinks3 = {
  ldap: /(?:\.|->)search(?:_s|_st|_ext|_ext_s|ForObject)?\s*\(|\bldap_(?:search|list|read)\s*\(|\bDirectorySearcher\s*\(|\.Filter\s*=(?!=)|\bNewSearchRequest\s*\(|\bnew\s+SearchRequest\s*\(|\.authenticate\s*\(|\bfilter\s*:/,
  xpath: /(?:\.|->)(?:xpath|at_xpath|selectNodes|selectSingleNode|SelectNodes|SelectSingleNode|XPathSelectElements?|XPathEvaluate)\s*\(|\b[xX][pP]ath\w*(?:\.|->)(?:evaluate|compile|query|select1?|Select|Evaluate|Compile)\s*\(|\bXPath(?:\.(?:first|match|each))?\s*\(|\b(?:document|doc)\.evaluate\s*\(/
};
var inserted = [
  { pattern: /(?:^|[(\s,=])(?:[rR]?[fF]|[fF][rR])(?:"[^"]*\{|'[^']*\{)/ },
  // Python f-string
  { pattern: /["']\s*%\s*[\w(]/, operator: true },
  // Python "... %s" % value
  { pattern: /["']\.format\(/, operator: true },
  // Python and C# .format()
  { pattern: /`[^`]*\$\{/ },
  // JavaScript template literal
  { pattern: /["'`]\s*\+\s*[\w$(]|[\w$)\]]\s*\+\s*["'`]/, operator: true },
  // concatenation
  { pattern: /\b(?:fmt\.Sprintf|String\.format|sprintf)\s*\(/ },
  // Go, Java, PHP
  { pattern: /"[^"]*#\{/ }
  // Ruby interpolation
];
var quotedText = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
var languageInserted = [
  [/\.php$/i, /"[^"]*\$[a-zA-Z_{]|["']\s*\.\s*\$|\$\w+\s*\.\s*["']/],
  [/\.cs$/i, /\$@?"[^"]*\{/]
];
var escaped = /escape_filter_chars|ldap_escape|escapeFilter|escape_filter|filterEncode|EscapeFilter|escapeLDAP|encodeForLDAP|encodeForDN|LdapEncoder|Filter\.(?:createEqualityFilter|create)|EqualsFilter|LdapQueryBuilder|encodeForXPath|escapeXPath|xpathEscape|XPathVariableResolver|setXPathVariableResolver/i;
var assignment4 = /^\s*(?:(?:const|let|var|final|String|string|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)/;
var reach3 = 20;
var sourceFile4 = /\.(?:[cm]?[jt]sx?|py|rb|php|java|kt|scala|cs|go)$/i;
var skippedFile5 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var commentLine12 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var maxLineLength10 = 1e3;
var ldapXpathInjectionRule = {
  id: "ldap-xpath-injection",
  description: "Flags LDAP filters and XPath expressions built by inserting values into their text.",
  run({ files, config: config2 }) {
    if (!config2.rules.ldapXpathInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !sourceFile4.test(file.path) || skippedFile5.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const patterns3 = [...inserted, ...languageInserted.filter(([files2]) => files2.test(file.path)).map(([, pattern]) => ({ pattern }))];
      const found = findBuiltQueries(file.patch, patterns3);
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))].sort((a, b) => a - b);
      const kinds3 = Object.keys(labels5).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "ldap-xpath-injection",
          title: "LDAP or XPath query built from text",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "insert values into" : "inserts a value into"} ${kinds3.map((kind) => labels5[kind]).join(", and ")}.`,
          recommendation: 'Escape each value for the query language before inserting it, such as `escape_filter_chars` in python-ldap and ldap3, `ldap_escape` in PHP, `ldap.EscapeFilter` in Go, or `LdapEncoder.filterEncode` in Spring, or build filters with a library\'s filter objects. For XPath, bind values as variables, such as `tree.xpath("//user[name=$name]", name=name)` in lxml or an `XPathVariableResolver` in Java.'
        }
      ];
    });
  }
};
function findBuiltQueries(patch, insertedPatterns) {
  const lines = patchLines(patch);
  const found = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength10 || commentLine12.test(content) || escaped.test(content)) {
      return;
    }
    const masked = content.replace(quotedText, (text) => `${text[0]}${text[0]}`);
    if (!insertedPatterns.some(({ pattern, operator }) => pattern.test(operator ? masked : content))) {
      return;
    }
    for (const kind of Object.keys(shapes)) {
      if (!shapes[kind].test(content)) {
        continue;
      }
      const name = assignment4.exec(content)?.[1];
      const reaches2 = sinks3[kind].test(content) || name !== void 0 && lines.slice(index + 1).some(
        (later) => later.line - line <= reach3 && sinks3[kind].test(later.content) && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(later.content.slice(later.content.search(sinks3[kind])))
      );
      if (reaches2) {
        found.push({ line, kind });
      }
    }
  });
  return found;
}

// src/rules/upload-filename.ts
var languages3 = [
  {
    // Flask and Werkzeug. Django's `request.FILES` is a request value that untrusted-input reads.
    files: /\.py$/i,
    clientName: /\{upload\}\.filename\b|\brequest\.files\s*(?:\[[^\]]*\]|\.get\s*\([^)]*\))\s*\.filename\b/,
    upload: /^\s*(?:for\s+)?([A-Za-z_]\w*)\s*(?:=|in)\s*request\.files\b/,
    sink: /\.save\s*\(|\bos\.path\.join\s*\(|\bopen\s*\(|\bPath\s*\(|\bshutil\.(?:move|copy\w*)\s*\(|\bos\.(?:rename|replace)\s*\(|\/\s*[A-Za-z_]\w*\.filename\b/,
    guard: /\bsecure_filename\s*\(|\buuid\w*\s*\(|\bos\.path\.basename\s*\(|\bget_valid_filename\s*\(/
  },
  {
    // multer's `originalname`, and express-fileupload's `req.files.<field>.name`.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    clientName: /\.originalname\b|\breq\.files(?:\.\w+|\[[^\]]+\])\.name\b|\{upload\}\.name\b/,
    upload: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*req\.files\b/,
    sink: /\bpath\.(?:join|resolve)\s*\(|\bfs(?:\.promises)?\.(?:writeFile|writeFileSync|createWriteStream|rename|renameSync|copyFile|copyFileSync)\s*\(|\.mv\s*\(|\bcb\s*\(\s*null\s*,|\bcallback\s*\(\s*null\s*,/,
    guard: /\bpath\.basename\s*\(|\bsanitize\w*\s*\(|\b(?:uuid|randomUUID|nanoid|randomBytes)\w*\s*\(|\bDate\.now\s*\(/
  },
  {
    files: /\.php$/i,
    clientName: /\$_FILES\s*\[[^\]]+\]\s*\[\s*["']name["']\s*\]|->getClientOriginalName\s*\(\s*\)/,
    sink: /\bmove_uploaded_file\s*\(|\bcopy\s*\(|\bfile_put_contents\s*\(|\bfopen\s*\(|->(?:move|storeAs)\s*\(/,
    guard: /\bbasename\s*\(|\bpathinfo\s*\(|\buniqid\s*\(|\brandom_bytes\s*\(|\bStr::(?:random|uuid)\s*\(|->hashName\s*\(/
  },
  {
    // Spring's MultipartFile and the Servlet API's Part.
    files: /\.(?:java|kt)$/i,
    clientName: /\.(?:getOriginalFilename|getSubmittedFileName)\s*\(\s*\)|\.originalFilename\b/,
    sink: /\bnew\s+File\s*\(|\b(?:Paths\.get|Path\.of)\s*\(|\.resolve\s*\(|\.transferTo\s*\(|\bFiles\.(?:copy|write|move)\s*\(|\bnew\s+FileOutputStream\s*\(/,
    guard: /\bFilenameUtils\.getName\s*\(|\.getFileName\s*\(\s*\)|\bUUID\.randomUUID\s*\(|\bsanitize\w*\s*\(/
  },
  {
    // multipart.FileHeader, from `r.FormFile` or `r.MultipartForm.File`.
    files: /\.go$/i,
    clientName: /\.Filename\b/,
    sink: /\bos\.(?:Create|OpenFile|WriteFile|Rename)\s*\(|\bfilepath\.Join\s*\(|\bpath\.Join\s*\(|\.SaveUploadedFile\s*\(/,
    guard: /\bfilepath\.Base\s*\(|\bpath\.Base\s*\(|\buuid\.\w+\s*\(/
  },
  {
    // ASP.NET Core's IFormFile.
    files: /\.cs$/i,
    clientName: /\{upload\}\.FileName\b|\bRequest\.Form\.Files\s*\[[^\]]+\]\s*\.FileName\b/,
    upload: /\bIFormFile\w*\s*(?:<[^>]*>)?\s+([A-Za-z_]\w*)|\bforeach\s*\(\s*(?:var|IFormFile)\s+([A-Za-z_]\w*)\s+in\s+(?:Request\.Form\.Files|\w*[fF]iles)\b/,
    sink: /\bPath\.Combine\s*\(|\bFile\.(?:Create|OpenWrite|WriteAllBytes|Move|Copy)\s*\(|\bnew\s+FileStream\s*\(/,
    guard: /\bPath\.GetFileName\s*\(|\bPath\.GetRandomFileName\s*\(|\bGuid\.NewGuid\s*\(/
  },
  {
    // Rails and Rack uploads.
    files: /\.rb$/i,
    clientName: /\.original_filename\b/,
    sink: /\bFile\.(?:join|open|write|rename)\b|\bFileUtils\.(?:mv|cp|move|copy)\b|\bRails\.root\.join\b|\bIO\.copy_stream\b/,
    guard: /\bFile\.basename\s*\(|\bsanitize\w*|\bSecureRandom\.\w+/
  }
];
var manualBasename = /\blastIndexOf\s*\(\s*['"](?:\/|\\\\)['"]|\.split\s*\(\s*['"][/\\\\]+['"]\s*\)\s*(?:\.pop\s*\(|\[\s*-1\s*\])|\.rsplit\s*\(\s*['"]\/['"]/;
var assignment5 = /^\s*(?:(?:const|let|var|final|String|string|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var reach4 = 20;
var commentLine13 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation7 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile6 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength11 = 1e3;
var uploadFilenameRule = {
  id: "upload-filename",
  description: "Flags uploaded files saved or placed under the file name the client sent.",
  run({ files, config: config2 }) {
    if (!config2.rules.uploadFilename.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages3.find((candidate) => candidate.files.test(file.path));
      if (language === void 0 || file.patch === void 0 || documentation7.test(file.path) || skippedFile6.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findUnsafeSaves(file.patch, language);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "upload-filename",
          title: "Upload saved under the client's file name",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "save uploads under" : "saves an upload under"} the file name the client sent, which can hold \`../\` to leave the upload directory, overwrite another file, or end in \`.php\` or \`.html\` so the server runs or serves it.`,
          recommendation: "Store uploads under a name the server makes, such as a UUID, and keep the original name only as data. If the name must be kept, reduce it with `secure_filename`, `path.basename`, `basename`, `FilenameUtils.getName`, `filepath.Base`, or `Path.GetFileName`, and check its extension against a list of allowed types."
        }
      ];
    });
  }
};
function findUnsafeSaves(patch, language) {
  const uploads = /* @__PURE__ */ new Set();
  const names2 = /* @__PURE__ */ new Map();
  const found = [];
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength11 || commentLine13.test(content)) {
      continue;
    }
    const upload = language.upload?.exec(content);
    const uploadName = upload?.[1] ?? upload?.[2];
    if (uploadName !== void 0) {
      uploads.add(uploadName);
    }
    const holdsClientName = (text) => clientNamePattern(language, uploads).test(text) || [...names2].some(([name, at]) => line - at <= reach4 && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));
    const guarded2 = (text) => language.guard.test(text) || manualBasename.test(text);
    if (added && !guarded2(content) && language.sink.test(content)) {
      const afterSink = content.slice(content.search(language.sink));
      if (holdsClientName(afterSink)) {
        found.push(line);
      }
    }
    const assigned = assignment5.exec(content);
    if (assigned?.[1] !== void 0) {
      if (!guarded2(assigned[2] ?? "") && holdsClientName(assigned[2] ?? "")) {
        names2.set(assigned[1], line);
      } else {
        names2.delete(assigned[1]);
      }
    }
  }
  return found;
}
function clientNamePattern(language, uploads) {
  const names2 = [...uploads].map((name) => name.replace(/\$/g, "\\$"));
  const source = language.clientName.source.replace(/\\\{upload\\\}/g, names2.length === 0 ? "(?!)" : `(?<![\\w$.])(?:${names2.join("|")})`);
  return new RegExp(source);
}

// src/rules/reflected-xss.ts
var htmlText = /["'`][^"'`]*<\/?[a-zA-Z][\w-]*[\s>/]/;
var rendered = /^\s*(?:[\w$.]+\.)?(?:render\w*|\w*[tT]emplate\w*|renderToString)\s*\(/;
var notHtml = /\b(?:application\/json|text\/plain|text\/csv|application\/octet-stream)\b|\bmimetype\s*=\s*["'](?!text\/html)|\bcontent_type\s*=\s*["'](?!text\/html)|\.type\s*\(\s*["'](?:json|text|txt|plain)["']\s*\)/;
var languages4 = [
  {
    // Express sends text as HTML. `res.json` and `res.jsonp` escape nothing but are not HTML.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    sinks: [/\b(?:res|response)\.(?:send|write|end)\s*\(/],
    guard: /\bescape\w*\s*\(|\bencode(?:HTML|Html|ForHTML)\w*\s*\(|\bDOMPurify\.sanitize\s*\(|\bsanitize\w*\s*\(|\bxss\s*\(|\bhe\.(?:encode|escape)\s*\(|\b(?:Number|parseInt|parseFloat)\s*\(/
  },
  {
    // Flask and Django. A Flask view's returned text is an HTML response.
    files: /\.py$/i,
    sinks: [/\b(?:HttpResponse|make_response|Response)\s*\(/, /^\s*return\s+/],
    guard: /\bescape\s*\(|\bhtml\.escape\s*\(|\bmarkupsafe\.escape\s*\(|\bconditional_escape\s*\(|\bbleach\.clean\s*\(|\bnh3\.clean\s*\(|\bjsonify\s*\(|\bJsonResponse\s*\(|\b(?:int|float)\s*\(/
  },
  {
    files: /\.php$/i,
    sinks: [/(?:^\s*|<\?php\s+|;\s*)(?:echo|print)\b|<\?=|\bprintf\s*\(/],
    request: /\$_SERVER\s*\[\s*["'](?:PHP_SELF|REQUEST_URI|QUERY_STRING|HTTP_REFERER|HTTP_USER_AGENT)["']\s*\]/,
    guard: /\bhtmlspecialchars\s*\(|\bhtmlentities\s*\(|\bstrip_tags\s*\(|\besc_html\s*\(|\besc_attr\s*\(|\be\s*\(|\bintval\s*\(|\(int\)|\bjson_encode\s*\(/
  },
  {
    // net/http. The body's type is sniffed, so text that starts with `<` is served as HTML.
    files: /\.go$/i,
    sinks: [/\bfmt\.Fprint(?:f|ln)?\s*\(\s*w\s*,|\bw\.Write\s*\(|\bio\.WriteString\s*\(\s*w\s*,/],
    guard: /\bhtml\.EscapeString\s*\(|\btemplate\.HTMLEscape(?:String|r)?\s*\(|\bstrconv\.\w+\s*\(/
  },
  {
    // Servlets and JSP scriptlets.
    files: /\.(?:java|kt|jsp)$/i,
    sinks: [/\.getWriter\s*\(\s*\)\s*\.(?:print|println|write|append|printf)\s*\(|\bout\.(?:print|println|write)\s*\(/],
    request: /\b(?:request|req)\.get(?:Parameter|Header|QueryString|RequestURI)\s*\(/,
    guard: /\bescapeHtml\d?\s*\(|\bEncode\.forHtml\w*\s*\(|\bencodeForHTML\w*\s*\(|\bHtmlUtils\.htmlEscape\s*\(|\bInteger\.parseInt\s*\(/
  },
  {
    // ASP.NET and ASP.NET Core.
    files: /\.(?:cs|aspx|cshtml)$/i,
    sinks: [/\bResponse\.(?:Write|WriteAsync)\s*\(|\bContent\s*\([^)]*["']text\/html["']/],
    request: /\bRequest\.(?:QueryString|Params)\s*\[/,
    guard: /\bHtmlEncode\s*\(|\bHtmlEncoder\.\w+\.Encode\s*\(|\bAntiXssEncoder\.\w+\s*\(|\bint\.Parse\s*\(/
  }
];
var flaskRoute = /^\s*@\w+\.(?:route|get|post|put|patch|delete)\s*\(/;
var pythonDef = /^\s*(?:async\s+)?def\s+\w+\s*\(/;
var assignment6 = /^\s*(?:(?:const|let|var|final|String|string|\$)?\s*)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring4 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach5 = 20;
var builtText = /["'`]\s*(?:\+|\.|%)|(?:\+|\.)\s*["'`]|\b[fF]["']|`[^`]*\$\{|["']\.format\s*\(/;
var leadingChain = /^\s*(?:await\s+)?\$?([\w$]+(?:\??\.[\w$]+|\[[^\]]*\]|\([^()]*\))*)/;
var commentLine14 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation8 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile7 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength12 = 1e3;
var reflectedXssRule = {
  id: "reflected-xss",
  description: "Flags request values written straight into an HTML response.",
  run({ files, config: config2 }) {
    if (!config2.rules.reflectedXss.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages4.find((candidate) => candidate.files.test(file.path));
      if (language === void 0 || file.patch === void 0 || documentation8.test(file.path) || skippedFile7.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findReflections(file.patch, language);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "reflected-xss",
          title: "Request value written into an HTML response",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} from the request straight into an HTML response, so a link with \`<script>\` in it runs that script for whoever opens it (reflected cross-site scripting).`,
          recommendation: "Render the response with a template that escapes values, or escape the value for HTML first, such as with `html.escape`, `htmlspecialchars`, `html.EscapeString`, `Encode.forHtml`, or `HtmlEncoder.Default.Encode`. Send data as JSON or plain text when it is not meant to be HTML."
        }
      ];
    });
  }
};
function findReflections(patch, language) {
  const fromRequest = (text) => requestValue.test(text) || (language.request?.test(text) ?? false);
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  let inRoute = false;
  let routeNext = false;
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength12 || commentLine14.test(content)) {
      continue;
    }
    if (flaskRoute.test(content)) {
      routeNext = true;
    } else if (pythonDef.test(content)) {
      inRoute = routeNext;
      routeNext = false;
    }
    const isTainted = (text) => fromRequest(text) || [...tainted].some(([name, at]) => line - at <= reach5 && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text));
    const sink = language.sinks.map((pattern) => pattern.exec(content)).find((match2) => match2 !== null) ?? null;
    if (added && sink !== null && !language.guard.test(content) && !notHtml.test(content)) {
      const written = content.slice(sink.index + sink[0].length);
      const isReturn = /^\s*return\b/.test(sink[0]);
      const isResponse = !isReturn || (inRoute || htmlText.test(written)) && !/^\s*[{[]/.test(written);
      if (isResponse && !rendered.test(written) && isTainted(written)) {
        found.push(line);
      }
    }
    const names2 = destructuring4.exec(content);
    if (names2 !== null && fromRequest(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const assigned = assignment6.exec(content);
    if (assigned?.[1] !== void 0) {
      const value = assigned[2] ?? "";
      const lead = leadingChain.exec(value)?.[1] ?? "";
      const startsWithRequest = [requestValue, language.request].some((pattern) => pattern?.exec(lead)?.index === 0);
      const firstName = /^[\w$]+/.exec(lead)?.[0] ?? "";
      const direct = startsWithRequest || tainted.has(firstName) && line - (tainted.get(firstName) ?? 0) <= reach5;
      if (!language.guard.test(value) && (direct || builtText.test(value) && isTainted(value))) {
        tainted.set(assigned[1], line);
      } else {
        tainted.delete(assigned[1]);
      }
    }
  }
  return found;
}

// src/rules/log-injection.ts
var requestValue2 = /\b(?:req|request|ctx(?:\.request)?)\.(?:query|body|cookies)\b|\brequest\.(?:args|form|values|json|get_json\(|GET|POST|COOKIES|data|query_params)\b|\$_(?:GET|POST|REQUEST|COOKIE)\b|\br\.(?:URL\.Query\(\)|FormValue\(|PostFormValue\()|\bRequest\.(?:Query|Form|Cookies)\[|\bsearchParams\.get\(/;
var wholeObject = /\b(?:req|request|ctx(?:\.request)?)\.(?:query|params|body|cookies|args|form|values|json|data|GET|POST|COOKIES|query_params)\b(?!\s*(?:\.|\[|\?\.|\())/g;
var servletValue2 = /\b(?:request|req)\.getParameter(?:Values)?\s*\(/;
var cleaned = /\.replace(?:All)?\s*\(\s*(?:\/[^/]*\\[rn][^/]*\/[gimsuy]*|["'][^"']*\\[rn][^"']*["'])|\brepr\s*\(|%r\b|!r\}|%q\b|\bJSON\.stringify\s*\(|\bjson\.dumps\s*\(|\bstrconv\.Quote\s*\(|\b(?:sanitize|escape|encode|clean|strip)\w*\s*\(|\bStringEscapeUtils\.escape\w+\s*\(|\bEncode\.for\w+\s*\(|\.inspect\b|\bp\s*\(/i;
var structuredFirst = /^\s*\{/;
var assignment7 = /^\s*(?:(?:const|let|var|final|String|string)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring5 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach6 = 20;
var sourceFile5 = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
var skippedFile8 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var commentLine15 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var maxLineLength13 = 1e3;
var logInjectionRule = {
  id: "log-injection",
  description: "Flags request values written into the text of a log line without removing line breaks.",
  run({ files, config: config2 }) {
    if (!config2.rules.logInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !sourceFile5.test(file.path) || skippedFile8.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findInjectedLogs(file.path, file.patch);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "log-injection",
          title: "Request value written into a log line",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} from the request into the text of a log line, so a value with a line break in it can add fake entries, such as a forged login, to the log.`,
          recommendation: 'Remove line breaks first, such as `value.replace(/[\\r\\n]/g, "")`, log a quoted form such as `%r` in Python or `%q` in Go, or use a structured logger that writes fields as JSON, such as pino, structlog, or Logback\'s JSON encoder, and pass the value as a field.'
        }
      ];
    });
  }
};
function findInjectedLogs(path2, patch) {
  const ruby5 = /\.(?:rb|erb|rake)$/i.test(path2);
  const java5 = /\.(?:java|kt|scala)$/i.test(path2);
  const fromRequest = (text) => requestValue2.test(text) || ruby5 && railsParams.test(text) || java5 && servletValue2.test(text);
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength13 || commentLine15.test(content)) {
      continue;
    }
    const isTainted = (text) => fromRequest(text) || [...tainted].some(([name, at]) => line - at <= reach6 && new RegExp(`(?<![\\w$.:])\\$?${name}(?![\\w$])`).test(text));
    const call = logCall.exec(content);
    if (added && call !== null && !cleaned.test(content)) {
      const args = codeOutsideText(content.slice(call.index + call[0].length)).replace(wholeObject, "");
      if (!structuredFirst.test(args) && isTainted(args)) {
        found.push(line);
      }
    }
    const names2 = destructuring5.exec(content);
    if (names2 !== null && fromRequest(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const assigned = assignment7.exec(content);
    if (assigned?.[1] !== void 0) {
      const value = (assigned[2] ?? "").replace(/^\s*await\s+/, "");
      const starts = [requestValue2, ruby5 ? railsParams : void 0, java5 ? servletValue2 : void 0].some(
        (pattern) => pattern?.exec(value)?.index === 0
      );
      if (starts && !cleaned.test(value)) {
        tainted.set(assigned[1], line);
      } else {
        tainted.delete(assigned[1]);
      }
    }
  }
  return found;
}

// src/rules/static-iv.ts
var sinks4 = [
  // Node.js crypto.
  { files: /\.(?:[cm]?[jt]sx?)$/i, call: /\bcreate(?:Cipher|Decipher)iv\s*\(/g, argument: 2 },
  // pyca/cryptography modes and PyCryptodome.
  { files: /\.py$/i, call: /\bmodes\.(?:CBC|GCM|CTR|CFB|CFB8|OFB|XTS)\s*\(/g, argument: 0 },
  { files: /\.py$/i, call: /\b(?:AES|DES3|ChaCha20|ChaCha20_Poly1305|Salsa20)\.new\s*\(/g, argument: 2 },
  // Java's javax.crypto.
  { files: /\.(?:java|kt|scala)$/i, call: /\bnew\s+IvParameterSpec\s*\(/g, argument: 0 },
  { files: /\.(?:java|kt|scala)$/i, call: /\bnew\s+GCMParameterSpec\s*\(/g, argument: 1 },
  // Go's crypto/cipher, and an AEAD's Seal and Open.
  { files: /\.go$/i, call: /\bcipher\.New(?:CBC(?:En|De)crypter|CTR|CFB(?:En|De)crypter|OFB)\s*\(/g, argument: 1 },
  { files: /\.go$/i, call: /\b(?:gcm|aead|aesgcm|aesGCM|chacha|ccm)\.(?:Seal|Open)\s*\(/gi, argument: 1 },
  // .NET.
  { files: /\.cs$/i, call: /\.IV\s*=(?!=)/g, argument: "assigned" },
  { files: /\.cs$/i, call: /\.Create(?:En|De)cryptor\s*\(/g, argument: 1 },
  // PHP's OpenSSL and libsodium.
  { files: /\.php$/i, call: /\bopenssl_(?:en|de)crypt\s*\(/g, argument: 4 },
  { files: /\.php$/i, call: /\bsodium_crypto_secretbox(?:_open)?\s*\(/g, argument: 1 },
  // Ruby's OpenSSL::Cipher.
  { files: /\.rb$/i, call: /\.iv\s*=(?!=)/g, argument: "assigned" }
];
var keyedIv = /(?:^|[,({\s])(?:iv|nonce|initialization_vector)\s*[=:](?!=)\s*/g;
var shorthandIv = /[{,]\s*(iv|nonce)\s*(?=[,}])/g;
var keyedFiles = /\.(?:py|[cm]?[jt]sx?)$/i;
var keyedContext = /\bsubtle\.(?:en|de)crypt\s*\(|\bAES-(?:GCM|CBC|CTR)\b|\.new\s*\(|\bCipher\s*\(|\bmodes\./;
var fixedValue = new RegExp(
  [
    String.raw`^[bBrRuU]{0,2}["'\`]`,
    String.raw`^"[^"]*"\s*\.\s*(?:getBytes|encode|toByteArray)\s*\(`,
    String.raw`^Buffer\.(?:from\s*\(\s*["'\`[]|alloc\s*\(\s*\d+\s*\))`,
    String.raw`^new\s+(?:Uint8Array|Buffer)\s*\(\s*(?:\d+|\[)`,
    String.raw`^new\s+byte\s*\[\s*\w*\s*\](?:\s*\{)?`,
    String.raw`^byteArrayOf\s*\(|^ByteArray\s*\(\s*\d+\s*\)`,
    String.raw`^make\s*\(\s*\[\]byte\s*,`,
    String.raw`^\[\]byte\s*(?:\(\s*"|\{)`,
    String.raw`^(?:Encoding\.\w+|System\.Text\.Encoding\.\w+)\.GetBytes\s*\(\s*"`,
    String.raw`^bytes\s*\(\s*(?:\d+|\[)`,
    String.raw`^bytearray\s*\(\s*\d+\s*\)`,
    String.raw`^b?["']\\x00["']\s*\*`,
    String.raw`^str_repeat\s*\(`,
    String.raw`^\[\s*(?:0x)?\d`,
    String.raw`^\{\s*(?:\(byte\)\s*)?(?:0x)?\d`
  ].join("|")
);
var randomFill = /\b(?:randomFill(?:Sync)?|getRandomValues|ReadFull|rand\.Read|nextBytes|RAND_bytes|urandom|token_bytes|get_random_bytes|random_bytes|openssl_random_pseudo_bytes|randombytes_buf|random_iv|RandomNumberGenerator|GenerateIV|randomBytes|SecureRandom|generateIv|random_key)\b/;
var assignment8 = /^\s*(?:(?:const|let|var|final|private|public|protected|static|readonly|val|byte\[\]|\[\]byte|var)\s+)*(?:byte\s*\[\]\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*?);?\s*$/;
var reach7 = 60;
var commentLine16 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation9 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile9 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength14 = 1e3;
var staticIvRule = {
  id: "static-iv",
  description: "Flags encryption with an IV or nonce that is the same every time.",
  run({ files, config: config2 }) {
    if (!config2.rules.staticIv.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks4.filter((sink) => sink.files.test(file.path));
      const keyed = keyedFiles.test(file.path);
      if (fileSinks.length === 0 && !keyed || file.patch === void 0 || documentation9.test(file.path) || skippedFile9.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findStaticIvs(patchLines(file.patch), fileSinks, keyed);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "static-iv",
          title: "Encryption with a fixed IV or nonce",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "encrypt" : "encrypts"} with an IV or nonce that is the same every time. With CBC, this shows which messages start the same; with GCM or ChaCha20, reusing a nonce with the same key reveals the plaintexts and lets messages be forged.`,
          recommendation: "Make a new random IV or nonce for every message, such as `crypto.randomBytes(12)`, `os.urandom(12)`, `SecureRandom.nextBytes`, or `io.ReadFull(rand.Reader, nonce)`, and store it next to the ciphertext. It does not need to be secret."
        }
      ];
    });
  }
};
function findStaticIvs(lines, fileSinks, keyed) {
  const found = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength14 || commentLine16.test(content) || randomFill.test(content)) {
      return;
    }
    const ivs = [];
    for (const sink of fileSinks) {
      sink.call.lastIndex = 0;
      for (const match2 of content.matchAll(sink.call)) {
        const rest = content.slice(match2.index + match2[0].length);
        const value = sink.argument === "assigned" ? rest.replace(/;\s*$/, "") : splitArguments2(rest)[sink.argument];
        if (value !== void 0) {
          ivs.push(value.replace(/^\s*(?:iv|nonce|IV)\s*[=:]\s*/, ""));
        }
      }
    }
    if (keyed && keyedContext.test(content)) {
      keyedIv.lastIndex = 0;
      for (const match2 of content.matchAll(keyedIv)) {
        ivs.push(splitArguments2(content.slice(match2.index + match2[0].length))[0] ?? "");
      }
      shorthandIv.lastIndex = 0;
      for (const match2 of content.matchAll(shorthandIv)) {
        ivs.push(match2[1] ?? "");
      }
    }
    if (ivs.some((iv) => isFixed(iv.trim(), lines, index))) {
      found.push(line);
    }
  });
  return found;
}
function isFixed(iv, lines, index) {
  if (iv === "" || randomFill.test(iv)) {
    return false;
  }
  if (fixedValue.test(iv)) {
    return true;
  }
  const name = /^\$?([A-Za-z_][\w]*)\s*$/.exec(iv)?.[1];
  const current = lines[index];
  if (name === void 0 || current === void 0) {
    return false;
  }
  const uses = new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`);
  for (let at = index - 1; at >= 0; at -= 1) {
    const earlier = lines[at];
    if (earlier === void 0 || current.line - earlier.line > reach7) {
      return false;
    }
    if (randomFill.test(earlier.content) && uses.test(earlier.content)) {
      return false;
    }
    const assigned = assignment8.exec(earlier.content);
    if (assigned?.[1] === name) {
      return fixedValue.test((assigned[2] ?? "").trim()) && !randomFill.test(assigned[2] ?? "");
    }
  }
  return false;
}
function splitArguments2(text) {
  const args = [];
  let depth = 0;
  let quote;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (quote !== void 0) {
      current += char;
      if (char === "\\") {
        current += text[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  args.push(current);
  return args;
}

// src/rules/plaintext-password.ts
var storedPassword = /(?<![\w$])\$?(?!(?:req|request|body|form|params|args|data|input|values|ctx|query|payload|dto|credentials|creds|login|cmd|command|model|vm|viewModel|e|event|_POST|_GET|_REQUEST|_COOKIE)\b)([A-Za-z_][\w$]*)(?:\??\.|->|\[\s*["']|\.get\s*\(\s*["']|\.get)(?:password|passwd|pwd|pass|user_password|userPassword|Password|PASSWORD|Passwd)\b(?:["']\s*\]|["']\s*\)|\s*\(\s*\))?/;
var typedPassword = /\b(?:req|request|ctx(?:\.request)?)\.(?:body|query|form|args|values|json|POST|GET|data)\b[^,;)]*(?:password|passwd|pwd|pass)|\$_(?:POST|GET|REQUEST)\s*\[\s*["'](?:password|passwd|pwd|pass)\w*["']|\bgetParameter\s*\(\s*"(?:password|passwd|pwd|pass)\w*"|\bparams\s*\[\s*:(?:password|passwd|pwd|pass)\w*\s*\]|(?<![\w$.>])\$?(?:password|passwd|pwd|pass|plain(?:_|text)?password|plainPassword|rawPassword|raw_password|input_?password|inputPassword|given_?password|givenPassword|candidate(?:_?password|Password)?|entered_?password|enteredPassword|submitted_?password|submittedPassword|provided_?password|providedPassword|user_?password|userPassword)\b(?!\s*(?:\.|\[|->|\())/i;
var notThePassword = /hash|digest|crypt|salt|confirm|repeat|retype|again|verify|old|new|reset|policy|length|len\b|min|max|regex|pattern|strength|expir|changed|required|field|label|hint|placeholder/i;
var hashed = /\b(?:bcrypt|bcryptjs|argon2|scrypt|pbkdf2|hash\w*|verify\w*|compare\w*|check_password|checkpw|password_verify|matches|digest|crypt|encode|hmac|sha\d*|md5|timingSafeEqual|compare_digest|secure_compare|authenticate|SignInManager|PasswordHasher|passlib)\b/i;
var equality2 = /(?<![=!<>])(?:===|!==|==|!=)(?!=)/g;
var chainBefore2 = /(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\s*$/;
var chainAfter2 = /^\s*(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)/;
var equalsCall = /(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\.(?:equals|Equals)\s*\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
var twoArgumentEquals = /\b(?:Objects\.equals|String\.Equals|strcmp|hash_equals)\s*\(\s*([^,()]+(?:\([^()]*\))?)\s*,\s*([^,()]+(?:\([^()]*\))?)\s*[,)]/g;
var sourceFile6 = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
var skippedFile10 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var commentLine17 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var maxLineLength15 = 1e3;
var plaintextPasswordRule = {
  id: "plaintext-password",
  description: "Flags passwords compared with the stored password directly, which means passwords are stored in plain text.",
  run({ files, config: config2 }) {
    if (!config2.rules.plaintextPassword.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !sourceFile6.test(file.path) || skippedFile10.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch).flatMap(
        ({ line, content, added }) => added && content.length <= maxLineLength15 && !commentLine17.test(content) && !hashed.test(content) && comparesPlaintext(content) ? [line] : []
      );
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "plaintext-password",
          title: "Password compared in plain text",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compare" : "compares"} the password a user typed with the stored password directly, which means passwords are stored as they were typed: anyone who reads the database, a backup, or a log of it has every user's password.`,
          recommendation: "Store only a slow, salted hash of each password, made with bcrypt, scrypt, Argon2, or PBKDF2, such as `bcrypt.hash` and `bcrypt.compare`, Django's `make_password` and `check_password`, `password_hash` and `password_verify` in PHP, Spring's `PasswordEncoder`, or ASP.NET's `PasswordHasher`, and migrate the passwords already stored."
        }
      ];
    });
  }
};
function fieldOf2(chain) {
  return chain.replace(/^.*(?:\.|->|\[\s*["':]|\.get\s*\(\s*["'])/s, "");
}
function comparesPlaintext(content) {
  const pairs = [];
  for (const match2 of content.matchAll(equality2)) {
    const left = chainBefore2.exec(content.slice(0, match2.index))?.[1];
    const right = chainAfter2.exec(content.slice(match2.index + match2[0].length))?.[1];
    if (left !== void 0 && right !== void 0) {
      pairs.push([left, right]);
    }
  }
  for (const match2 of content.matchAll(equalsCall)) {
    pairs.push([match2[1] ?? "", match2[2] ?? ""]);
  }
  for (const match2 of content.matchAll(twoArgumentEquals)) {
    pairs.push([match2[1] ?? "", match2[2] ?? ""]);
  }
  return pairs.some(([left, right]) => isPair(left.trim(), right.trim()) || isPair(right.trim(), left.trim()));
}
function isPair(stored, typed) {
  if (notThePassword.test(fieldOf2(stored)) || notThePassword.test(fieldOf2(typed))) {
    return false;
  }
  return storedPassword.test(stored) && typedPassword.test(typed) && !storedPassword.test(typed.replace(/^\$?this\b/, "x"));
}

// src/rules/admin-route-auth.ts
var adminPath = /^\/?(?:api\/)?(?:v\d+\/)?(?:admin|administrator|superadmin|superuser|backoffice|back-office|staff|internal|manage|management|sudo)(?:\/|$|:|\?)/i;
var guardName = /auth|login|logged|session|jwt|token|passport|guard|protect|permission|perm\b|perms|role|acl|policy|restrict|secure|(?:^|[._])(?:is|require|ensure|verify|check|has|must|only)[A-Z_]|_required\b|Required\b|requires_|can\(|admin_?only|adminOnly|staff_member_required|user_passes_test|superuser/i;
var inlineCheck = /\breq\.(?:user|session|auth)\b|\bisAuthenticated\b|\bhasRole\b|\bisAdmin\b|\bis_admin\b|\bis_staff\b|\bis_superuser\b|\bcurrent_user\b|\bg\.user\b|\babort\s*\(\s*40[13]\b|\bstatus\s*\(\s*40[13]\b|\bStatus(?:Unauthorized|Forbidden)\b|\b40[13]\b|Forbidden|Unauthorized|\bauth\(\)|->can\(|Gate::/;
var fileGuard = /\.use\s*\([^)]*(?:auth|login|session|jwt|passport|guard|protect|permission|role|acl|require|ensure|verify|isAdmin|admin)/i;
var fileHooks = /\.Group\s*\(\s*"[^"]*"\s*,[^)]*(?:auth|login|session|jwt|token|guard|protect|permission|role|acl|require|ensure|verify|admin)|\bbefore_request\b|\bbefore_action\b|\bbeforeEach\b|\.addHook\s*\(\s*["'](?:onRequest|preHandler)["']|\bmiddleware\s*\(\s*\[?[^)]*(?:auth|admin|role|can:|permission|verified)/i;
var javascript2 = {
  // Express, Koa Router, Fastify, Hono.
  files: /\.(?:[cm]?[jt]sx?)$/i,
  route: /\b(?:app|router|server|fastify|api|admin\w*|routes?|r)\.(?:get|post|put|patch|delete|del|all|use|route)\s*\(\s*["'`]([^"'`]+)["'`]\s*,?/,
  guarded(lines, index, rest) {
    const args = rest.split(",").map((part) => part.trim());
    const middleware = args.slice(0, -1).join(",");
    return guardName.test(middleware) || bodyChecks(lines, index);
  }
};
var python2 = {
  // Flask and Quart routes, with the decorators above or below the route.
  files: /\.py$/i,
  route: /^\s*@\w+\.(?:route|get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/,
  guarded(lines, index) {
    const decorators = [];
    for (let at = index - 1; at >= 0 && /^\s*@/.test(lines[at]?.content ?? ""); at -= 1) {
      decorators.push(lines[at]?.content ?? "");
    }
    for (let at = index + 1; at < lines.length && /^\s*@/.test(lines[at]?.content ?? ""); at += 1) {
      decorators.push(lines[at]?.content ?? "");
    }
    return decorators.some((decorator) => guardName.test(decorator)) || bodyChecks(lines, index);
  }
};
var go = {
  // net/http, gin, echo, chi, and fiber.
  files: /\.go$/i,
  route: /\b(?:http\.Handle(?:Func)?|\w+\.(?:GET|POST|PUT|PATCH|DELETE|Any|Handle|HandleFunc|Get|Post|Put|Patch|Delete|Group|Route|Mount))\s*\(\s*"([^"]+)"\s*,?/,
  guarded(lines, index, rest) {
    const args = rest.split(",").map((part) => part.trim());
    return guardName.test(args.slice(0, -1).join(",")) || guardName.test(args.at(-1) ?? "") || bodyChecks(lines, index);
  }
};
var php = {
  // Laravel routes, alone or inside a group that applies middleware.
  files: /\.php$/i,
  route: /\bRoute::(?:get|post|put|patch|delete|any|match|resource|prefix|group)\s*\(\s*["']([^"']+)["']/,
  guarded(lines, index, rest) {
    if (/->middleware\s*\(/.test(rest) && guardName.test(rest)) {
      return true;
    }
    return lines.slice(Math.max(0, index - 30), index).some(({ content }) => /middleware\s*\(/.test(content) && /->group\s*\(/.test(content) && guardName.test(content));
  }
};
var languages5 = [javascript2, python2, go, php];
var commentLine18 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation10 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile11 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var bodyReach3 = 12;
var adminRouteAuthRule = {
  id: "admin-route-auth",
  description: "Flags admin and internal routes registered without an authentication or role check.",
  run({ files, config: config2 }) {
    if (!config2.rules.adminRouteAuth.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages5.find((candidate) => candidate.files.test(file.path));
      if (language === void 0 || file.patch === void 0 || documentation10.test(file.path) || skippedFile11.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch);
      const routes = findRoutes(lines, language);
      const adminRoutes = routes.filter((route) => adminPath.test(route.path));
      const unguarded = adminRoutes.filter((route) => !route.guarded && lines[route.index]?.added);
      if (unguarded.length === 0) {
        return [];
      }
      const visible = lines.map(({ content }) => content).join("\n");
      if (fileGuard.test(visible) || fileHooks.test(visible)) {
        return [];
      }
      if (file.status !== "added" && !routes.some((route) => route.guarded)) {
        return [];
      }
      const lineNumbers = unguarded.map((route) => route.line);
      const { text, plural } = describeLines(lineNumbers);
      return [
        {
          ruleId: "admin-route-auth",
          title: "Admin route without an access check",
          severity: "warning",
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "register admin or internal routes" : "registers an admin or internal route"} with no authentication or role check in sight, so anyone who finds the URL can use ${plural ? "them" : "it"}.`,
          recommendation: "Put an authentication and role check in front of the route, such as Express middleware like `requireAdmin`, Flask's `@login_required` with a role check, a gin group with an auth middleware, or Laravel's `->middleware(['auth', 'can:admin'])`. If a router or gateway already protects it elsewhere, say so in the review."
        }
      ];
    });
  }
};
function findRoutes(lines, language) {
  return lines.flatMap(({ line, content }, index) => {
    if (commentLine18.test(content)) {
      return [];
    }
    const match2 = language.route.exec(content);
    if (match2 === null) {
      return [];
    }
    const rest = content.slice(match2.index + match2[0].length);
    return [{ line, index, path: match2[1] ?? "", guarded: language.guarded(lines, index, rest) }];
  });
}
function bodyChecks(lines, index) {
  const start = lines[index];
  if (start === void 0) {
    return false;
  }
  return lines.slice(index, index + bodyReach3).some(({ line, content }) => line - start.line < bodyReach3 && inlineCheck.test(content));
}

// src/rules/zip-slip.ts
var labels6 = {
  join: [
    "builds a path from an archive entry's name without checking that it stays in the destination",
    "build paths from archive entry names without checking that they stay in the destination"
  ],
  tar: ["extracts a tar archive without a `filter`", "extract tar archives without a `filter`"]
};
var languages6 = [
  {
    // adm-zip's `entryName`, and unzipper's and tar-stream's `entry.path` and `header.name`. yauzl
    // rejects `..` and absolute paths in `entry.fileName` itself.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    entryName: /\b(?:\w*[eE]ntry|header|hdr)\.(?:path|entryName|name)\b|\.entryName\b/,
    sink: /\b(?:path|pth|nodePath|upath)(?:\.posix|\.win32)?\.(?:join|resolve)\s*\(|\bfs(?:\.promises)?\.(?:writeFile|writeFileSync|createWriteStream|mkdir|mkdirSync)\s*\(/,
    archive: /\b(?:yauzl|unzipper|adm-zip|AdmZip|jszip|JSZip|tar-stream|node-stream-zip|StreamZip|decompress|extract-zip|zip-lib|unzip|untar|extractAllTo)\b|\.(?:readEntry|getEntries)\s*\(|\.on\s*\(\s*['"]entry['"]/
  },
  {
    // tarfile's `member.name` and zipfile's `info.filename`, and the names `namelist()` and `getnames()` list.
    files: /\.py$/i,
    entryName: /\b(?:\w*(?:member|info|entry)|m|ti|zi)\.(?:name|filename)\b/,
    nameLoop: /^\s*for\s+([A-Za-z_]\w*)\s+in\s+[\w.]+\.(?:namelist|getnames)\s*\(\s*\)/,
    // `open(...)`, but not `zf.open(name)`, which reads the entry.
    sink: /\bos\.path\.join\s*\(|(?<![.\w])open\s*\(|\bPath\s*\(|\.joinpath\s*\(/,
    archive: /\b(?:tarfile|zipfile|TarFile|ZipFile|TarInfo|ZipInfo|namelist|getmembers|infolist|getnames)\b/,
    tarfile: true
  },
  {
    // A `*zip.File` or a `*tar.Header`, as in `for _, f := range r.File`.
    files: /\.go$/i,
    entryName: /\b(?:f|file|zf|zipFile|hdr|header|h|th|entry|fh)\.Name\b/,
    sink: /\bfilepath\.Join\s*\(|\bpath\.Join\s*\(|\bos\.(?:Create|OpenFile|MkdirAll|Mkdir|WriteFile)\s*\(/,
    archive: /\barchive\/(?:zip|tar)\b|\b(?:zip|tar)\.(?:File|Header|Reader|NewReader|OpenReader|FileHeader)\b/
  },
  {
    // `ZipEntry.getName()`, and zip4j's `FileHeader.getFileName()`. Paths are also built by hand,
    // with `File.separator`.
    files: /\.(?:java|kt)$/i,
    entryName: /\b\w*(?:[eE]ntry|ze)\.(?:getName\s*\(\s*\)|name\b)|\b\w*[hH]eader\.getFileName\s*\(\s*\)/,
    sink: /\bnew\s+File\s*\(|\b(?:Paths\.get|Path\.of)\s*\(|\.resolve(?:File)?\s*\(|\bnew\s+FileOutputStream\s*\(|\bFile\s*\(|\bFile\.separator\b|"file\.separator"/,
    archive: /\b(?:ZipEntry|ZipInputStream|ZipFile|JarEntry|JarFile|JarInputStream|TarArchiveEntry|ArchiveEntry|ZipArchiveEntry|ArchiveInputStream|getNextEntry|getNextTarEntry|getNextJarEntry)\b|\bjava\.util\.zip\b|\b\w*U[nN][aA]rchiver\b/
  },
  {
    // System.IO.Compression's `entry.FullName`, and SharpCompress's `entry.Key`.
    files: /\.cs$/i,
    entryName: /\b\w*[eE]ntry\w*\.(?:FullName|Name|Key)\b/,
    sink: /\bPath\.Combine\s*\(|\bFile\.(?:Create|OpenWrite|WriteAllBytes)\s*\(|\.ExtractToFile\s*\(|\bnew\s+FileStream\s*\(/,
    archive: /\b(?:ZipArchive|ZipArchiveEntry|ZipFile|IArchiveEntry|TarEntry|ZipEntry|SharpCompress|SharpZipLib|System\.IO\.Compression)\b/
  },
  {
    // rubyzip and RubyGems' tar reader.
    files: /\.(?:rb|rake)$/i,
    entryName: /\b\w*entry\w*\.(?:name|full_name)\b/,
    sink: /\bFile\.(?:join|expand_path|open|write)\b|\bFileUtils\.mkdir_p\b|\.extract\s*\(/,
    archive: /\b(?:Zip::File|Zip::InputStream|Zip::Entry|Gem::Package|Archive::Tar|Minitar|TarReader)\b/
  }
];
var containment = /\.start[sS]with\s*\(|\bHasPrefix\s*\(|\bStartsWith\s*\(|\bstart_with\?|\.indexOf\s*\([^)]*\)\s*(?:!==?|===?|<|>|<=|>=)\s*0\b|\b(?:getCanonicalPath|getCanonicalFile|toRealPath)\b|\b(?:path\.relative|filepath\.Rel|os\.path\.(?:commonpath|commonprefix|realpath)|is_relative_to|relative_to|filepath\.IsLocal|SecureJoin)\s*\(|["']\.\.["']|\.\.\/|\b\w*(?:[sS]anitiz|[sS]afe[A-Z_]|[sS]ecure|[wW]ithin|[iI]nside|[iI]llegal|[tT]raversal|[sS]lip|[iI]sLocal|[dD]ot[dD]ot|[sS]ubpath)\w*\s*\(/;
var checkHelper = /\b\w*(?:check|validat|verify|target)\w*(?:path|name|entry)\w*\s*\(/i;
var reduced = /\b(?:path\.basename|basename|filepath\.Base|path\.Base|Path\.GetFileName|File\.basename|os\.path\.basename|FilenameUtils\.getName)\s*\(|\b(?:path|pth)(?:\.posix)?\.join\s*\(\s*['"]\/['"]\s*,|\bfilepath\.Join\s*\(\s*"\/"/;
var entryNameVariable = /\b(?:entry_?[nN]ame|entryPath|entry_path|zipEntryName|archiveEntryName)\b/;
var before = 30;
var after = 12;
var tarOpen = /\b([A-Za-z_]\w*)\s*=\s*tarfile\.open\s*\(|\btarfile\.open\s*\(.*\)\s+as\s+([A-Za-z_]\w*)/;
var tarNames = /^(?:tar|tf|tarball|tar_file|tarf)$/;
var tarExtract = /(?:\b([A-Za-z_]\w*)|\btarfile\.open\s*\([^)]*\))\.extract(?:all)?\s*\(/;
var assignment9 = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var commentLine19 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation11 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile12 = /\.d\.[cm]?ts$|\.min\.[cm]?js$|(?:^|\/)tarfile(?:\.py|\/__init__\.py)$/i;
var maxLineLength16 = 1e3;
var zipSlipRule = {
  id: "zip-slip",
  description: "Flags archive entries written to a path built from their own name without checking that it stays in the destination.",
  run({ files, config: config2 }) {
    if (!config2.rules.zipSlip.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages6.find((candidate) => candidate.files.test(file.path));
      if (language === void 0 || file.patch === void 0 || documentation11.test(file.path) || skippedFile12.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch);
      if (!lines.some(({ content }) => language.archive.test(content))) {
        return [];
      }
      const found = [
        ...findJoins(lines, language),
        ...language.tarfile ? findTarExtracts(lines) : []
      ].sort((left, right) => left.line - right.line);
      if (found.length === 0) {
        return [];
      }
      const numbers = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = Object.keys(labels6).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "zip-slip",
          title: "Archive entry path not checked",
          severity: "warning",
          file: file.path,
          line: numbers[0],
          lines: numbers,
          message: `${text} ${kinds3.map((kind) => labels6[kind][plural ? 1 : 0]).join(", and ")}, so an entry named \`../../etc/cron.d/job\` or with an absolute path writes outside it (Zip Slip).`,
          recommendation: "Resolve each entry's path and check that it starts with the destination directory plus a separator before writing, as in `path.resolve(dest, name).startsWith(path.resolve(dest) + path.sep)`, Go's `filepath.IsLocal`, or Java's `toPath().normalize().startsWith(dest)`, and skip links that point outside it. With Python's tarfile, pass `filter=\"data\"`."
        }
      ];
    });
  }
};
function findJoins(lines, language) {
  const names2 = /* @__PURE__ */ new Map();
  const found = [];
  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength16 || commentLine19.test(content)) {
      return;
    }
    const holdsEntryName = (text) => language.entryName.test(text) || entryNameVariable.test(text) || [...names2].some(([name, at]) => index - at <= before && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));
    const loop = language.nameLoop?.exec(content)?.[1];
    if (loop !== void 0) {
      names2.set(loop, index);
    }
    if (added && !reduced.test(content) && language.sink.test(content)) {
      const afterSink = content.slice(content.search(language.sink));
      if (holdsEntryName(afterSink) && !checkedNearby(lines, index)) {
        found.push({ line, kind: "join" });
      }
    }
    const assigned = assignment9.exec(content);
    if (assigned?.[1] !== void 0 && assigned[1] !== loop) {
      const value = assigned[2] ?? "";
      if (!reduced.test(value) && !checkHelper.test(value) && holdsEntryName(value) && !checkedNearby(lines, index)) {
        names2.set(assigned[1], index);
      } else {
        names2.delete(assigned[1]);
      }
    }
  });
  return found;
}
function checkedNearby(lines, index) {
  for (let other = index; other >= Math.max(0, index - before); other -= 1) {
    if (isCheck(lines[other]?.content ?? "")) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  for (let other = index + 1; other < Math.min(lines.length, index + 1 + after); other += 1) {
    if (lines[other]?.startsHunk) {
      break;
    }
    if (isCheck(lines[other]?.content ?? "")) {
      return true;
    }
  }
  return false;
}
function isCheck(content) {
  return containment.test(content) || checkHelper.test(content);
}
function findTarExtracts(lines) {
  if (!lines.some(({ content }) => /\btarfile\b/.test(content)) || lines.some(({ content }) => /\.extraction_filter\s*=/.test(content))) {
    return [];
  }
  const opened = /* @__PURE__ */ new Set();
  return lines.flatMap(({ line, content, added }, index) => {
    const open2 = tarOpen.exec(content);
    if (open2 !== null) {
      opened.add(open2[1] ?? open2[2] ?? "");
    }
    const extract = tarExtract.exec(content);
    const receiver = extract?.[1];
    if (!added || extract === null || commentLine19.test(content) || receiver !== void 0 && !opened.has(receiver) && !tarNames.test(receiver) || checkedNearby(lines, index)) {
      return [];
    }
    const call = [content, ...lines.slice(index + 1, index + 4).map((next) => next.content)].join("\n");
    return /\bfilter\s*=/.test(argumentsOf(call, extract.index + extract[0].length)) ? [] : [{ line, kind: "tar" }];
  });
}
function argumentsOf(text, start) {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index);
      }
    }
  }
  return text.slice(start);
}

// src/rules/regex-injection.ts
var javascript3 = /\.(?:[cm]?[jt]sx?)$/i;
var python3 = /\.py$/i;
var ruby2 = /\.(?:rb|erb|rake)$/i;
var java2 = /\.(?:java|kt)$/i;
var sinks5 = [
  { label: "RegExp", files: javascript3, call: /(?<![\w$.])(?:new\s+)?RegExp\s*\(/g, argument: 0 },
  { label: "re", files: python3, call: /\b(?:re|regex)\.(?:compile|match|search|fullmatch|findall|finditer|sub|subn|split)\s*\(/g, argument: 0 },
  { label: "Django __regex", files: python3, call: /\b\w+__i?regex\s*=\s*/g, argument: 0 },
  { label: "Regexp.new", files: ruby2, call: /\bRegexp\.(?:new|compile)\s*\(/g, argument: 0 },
  { label: "Pattern.compile", files: java2, call: /\bPattern\.(?:compile|matches)\s*\(/g, argument: 0 },
  // String's `matches`, `replaceAll`, `replaceFirst`, and `split` read their first argument as a pattern.
  { label: "String.matches", files: java2, call: /\.(?:matches|replaceAll|replaceFirst|split)\s*\(/g, argument: 0 },
  { label: "Regex", files: /\.kt$/i, call: /(?<![\w.])(?:Regex|toRegex)\s*\(/g, argument: 0 },
  { label: "new Regex", files: /\.cs$/i, call: /\bnew\s+Regex\s*\(/g, argument: 0 },
  { label: "Regex.IsMatch", files: /\.cs$/i, call: /\bRegex\.(?:IsMatch|Match|Matches|Replace|Split)\s*\(/g, argument: 1 },
  { label: "preg_match", files: /\.php$/i, call: /\bpreg_(?:match|match_all|replace|replace_callback|split|grep)\s*\(/g, argument: 0 },
  // MongoDB's `$regex`, in any driver, runs the pattern on the database server.
  { label: "$regex", files: /\.(?:[cm]?[jt]sx?|py|php|rb)$/i, call: /["']?\$regex["']?\s*(?::|=>)\s*/g, argument: 0 }
];
var escaped2 = /\bescape\w*Reg\w*\s*\(|\bescapeRegex\w*\s*\(|\bescapeStringRegexp\s*\(|\b(?:re|regex)\.escape\s*\(|\bPattern\.quote\s*\(|\bpreg_quote\s*\(|\bRegexp\.(?:escape|quote)\s*\(|\bRegex\.Escape\s*\(|\bRegExp\.escape\s*\(|\b_\.escapeRegExp\s*\(|\bquote_?meta\s*\(/i;
var assignment10 = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring6 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach8 = 30;
var commentLine20 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation12 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile13 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength17 = 1e3;
var regexInjectionRule = {
  id: "regex-injection",
  description: "Flags regular expressions compiled from request input without escaping it.",
  run({ files, config: config2 }) {
    if (!config2.rules.regexInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks5.filter((sink) => sink.files.test(file.path));
      if (fileSinks.length === 0 || file.patch === void 0 || documentation12.test(file.path) || skippedFile13.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findPatterns(file.patch, file.path, fileSinks);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "regex-injection",
          title: "Regular expression built from request input",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compile regular expressions" : "compiles a regular expression"} from a request value without escaping it, so a request can send a pattern such as \`(a+)+$\` that takes exponential time to fail (ReDoS), or \`.*\` that matches every record.`,
          recommendation: "Escape the value before it goes into the pattern, with `escapeRegExp` or `RegExp.escape` in JavaScript, `re.escape` in Python, `Regexp.escape` in Ruby, `Pattern.quote` in Java, `Regex.Escape` in C#, or `preg_quote` in PHP, or match it as plain text with `includes`, `in`, or a `$eq` filter."
        }
      ];
    });
  }
};
function findPatterns(patch, path2, fileSinks) {
  const isRuby = ruby2.test(path2);
  const isJava = java2.test(path2);
  const fromRequest = (text) => requestValue.test(text) || isRuby && railsParams.test(text) || isJava && servletValue.test(text);
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength17 || commentLine20.test(content)) {
      continue;
    }
    const isTainted = (text) => !escaped2.test(text) && (fromRequest(text) || [...tainted].some(([name, at]) => line - at <= reach8 && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text)));
    if (added) {
      const reported = fileSinks.some(
        (sink) => [...content.matchAll(sink.call)].some(
          (match2) => isTainted(splitArguments(content.slice(match2.index + match2[0].length))[sink.argument] ?? "")
        )
      );
      const literal3 = isRuby && [...content.matchAll(/(?:%r\{|(?<![\w)\]}])\/)[^/\n]*#\{([^}]*)\}/g)].some((match2) => isTainted(match2[1] ?? ""));
      if (reported || literal3) {
        found.push(line);
      }
    }
    const names2 = destructuring6.exec(content);
    if (names2 !== null && fromRequest(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment10.exec(content);
    if (single !== null && single[1] !== void 0) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  }
  return [...new Set(found)];
}

// src/rules/electron-security.ts
function option(names2, value) {
  return new RegExp(`(?:(?<![\\w"'\`])(?:${names2})|["'](?:${names2})["'])\\s*:\\s*${value}\\b`);
}
var preferences = [
  { label: "nodeIntegration: true", pattern: option("nodeIntegration(?:InWorker|InSubFrames)?", "true"), critical: true },
  { label: "contextIsolation: false", pattern: option("contextIsolation", "false"), critical: true },
  { label: "webSecurity: false", pattern: option("webSecurity", "false"), critical: true },
  { label: "sandbox: false", pattern: option("sandbox", "false"), critical: false },
  { label: "allowRunningInsecureContent: true", pattern: option("allowRunningInsecureContent", "true"), critical: false },
  { label: "experimentalFeatures: true", pattern: option("experimentalFeatures", "true"), critical: false },
  { label: "enableRemoteModule: true", pattern: option("enableRemoteModule", "true"), critical: false }
];
var switches = [
  {
    label: "a command line switch that turns off certificate or same-origin checks",
    pattern: /\bappendSwitch\s*\(\s*["'](?:ignore-certificate-errors|disable-web-security)["']/,
    critical: true
  },
  {
    label: "a command line switch that turns off the sandbox or allows insecure content",
    pattern: /\bappendSwitch\s*\(\s*["'](?:no-sandbox|allow-running-insecure-content)["']/,
    critical: false
  },
  // A `<webview>` tag's attributes.
  { label: "<webview nodeintegration>", pattern: /<webview\b[^>]*\snodeintegration(?:insubframes)?\b/i, critical: true },
  { label: "<webview disablewebsecurity>", pattern: /<webview\b[^>]*\sdisablewebsecurity\b/i, critical: true }
];
var certificateHandler = /\.on\s*\(\s*["']certificate-error["']|\bsetCertificateVerifyProc\s*\(/;
var acceptsCertificate = /\b(?:callback|cb|done)\s*\(\s*(?:true|0)\s*\)/;
var handlerReach = 8;
var electronContext = /\b(?:BrowserWindow|BrowserView|WebContentsView|webPreferences|electron)\b|<webview\b/;
var sourceFile7 = /\.(?:[cm]?[jt]sx?|html?|vue|svelte|json)$/i;
var commentLine21 = /^\s*(?:\/\/|\/\*|\*|<!--)/;
var skippedFile14 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength18 = 1e3;
var electronSecurityRule = {
  id: "electron-security",
  description: "Flags Electron windows that give web content Node.js, turn off context isolation or web security, or accept any certificate.",
  run({ files, config: config2 }) {
    if (!config2.rules.electronSecurity.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (!sourceFile7.test(file.path) || file.patch === void 0 || skippedFile14.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch);
      if (!lines.some(({ content }) => electronContext.test(content))) {
        return [];
      }
      const found = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength18 || commentLine21.test(content)) {
          return;
        }
        const code = withoutText(content);
        for (const setting of [...preferences, ...switches]) {
          if (setting.pattern.test(code)) {
            found.push({ line, setting });
          }
        }
        if (acceptsCertificate.test(content) && acceptsEveryCertificate(lines, index)) {
          found.push({ line, setting: { label: "a certificate check that accepts every certificate", pattern: acceptsCertificate, critical: true } });
        }
      });
      if (found.length === 0) {
        return [];
      }
      const numbers = [...new Set(found.map((match2) => match2.line))];
      const labels14 = [...new Set(found.map((match2) => match2.setting.label))];
      const critical = found.some((match2) => match2.setting.critical);
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "electron-security",
          title: "Electron security setting weakened",
          severity: critical ? "high" : "warning",
          file: file.path,
          line: numbers[0],
          lines: numbers,
          message: `${text} ${plural ? "weaken" : "weakens"} Electron's isolation between web content and the computer (${labels14.join(", ")}). ${critical ? "A script injected into the page, through XSS or a URL it loads, can then use Node.js or other sites' data and run commands on the user's computer." : "A compromised page then has more of the system within its reach."}`,
          recommendation: "Keep Electron's defaults: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`, and expose only the functions the page needs through a preload script with `contextBridge.exposeInMainWorld`. Trust a private certificate authority by adding its certificate instead of accepting every certificate."
        }
      ];
    });
  }
};
function withoutText(content) {
  return content.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, (quoted3) => /\s/.test(quoted3) ? " ".repeat(quoted3.length) : quoted3);
}
function acceptsEveryCertificate(lines, index) {
  for (let other = index; other >= Math.max(0, index - handlerReach); other -= 1) {
    const content = lines[other]?.content ?? "";
    if (certificateHandler.test(content)) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  return false;
}

// src/rules/unsafe-reflection.ts
var javascript4 = /\.(?:[cm]?[jt]sx?)$/i;
var python4 = /\.py$/i;
var ruby3 = /\.(?:rb|erb|rake)$/i;
var java3 = /\.(?:java|kt)$/i;
var php2 = /\.php$/i;
var sinks6 = [
  { label: "require", files: javascript4, call: /(?<![\w$.])(?:require|import)\s*\(/g, argument: 0 },
  // A method looked up by name and called, as in `res[req.query.output](result)`. A table named as
  // one, such as `handlers[name]` or `sectionToController[section]`, maps names to fixed functions.
  { label: "method by name", files: javascript4, call: /(?<![\w$.])(?!\w*(?:[mM]ap|[tT]able|[hH]andlers?|[aA]ctions|[cC]ontrollers?|[rR]outes|[cC]onverters?|[cC]ommands|[sS]trategies|[fF]ormatters|[rR]enderers?)\b)(?![a-z]\w*To[A-Z]\w*\b)[\w$]+(?:\.[\w$]+)*\s*\[([^[\]]+)\]\s*\(/g, argument: "group" },
  { label: "import_module", files: python4, call: /\b(?:importlib\.import_module|__import__)\s*\(/g, argument: 0 },
  { label: "getattr", files: python4, call: /(?<![\w.])getattr\s*\(/g, argument: 1 },
  { label: "globals()", files: python4, call: /\b(?:globals|locals|vars)\s*\(\s*\)\s*\[([^[\]]+)\]/g, argument: "group" },
  { label: "constantize", files: ruby3, call: /\.(?:safe_)?constantize\b/g, argument: "receiver" },
  { label: "const_get", files: ruby3, call: /\bconst_get\s*\(/g, argument: 0 },
  { label: "send", files: ruby3, call: /\.(?:send|public_send|__send__|method|try)\s*\(/g, argument: 0 },
  { label: "Class.forName", files: java3, call: /\bClass\.forName\s*\(|\.loadClass\s*\(|\.get(?:Declared)?Method\s*\(/g, argument: 0 },
  { label: "Type.GetType", files: /\.cs$/i, call: /\bType\.GetType\s*\(|\bAssembly\.Load\w*\s*\(|\.GetMethod\s*\(|\bActivator\.CreateInstance\s*\(/g, argument: 0 },
  { label: "call_user_func", files: php2, call: /\bcall_user_func(?:_array)?\s*\(/g, argument: 0 },
  // `new $class()`, `$function()`, `$object->$method()`, and `$_GET['f']()`.
  { label: "variable function", files: php2, call: /(?:\bnew\s+|->\s*|(?<![\w$>:]))(\$\w+(?:\[[^\]]+\])?)\s*\(/g, argument: "group" },
  { label: "MethodByName", files: /\.go$/i, call: /\.MethodByName\s*\(/g, argument: 0 }
];
var allowlist = /\.include\?\s*\(|\bin_array\s*\(|\.(?:includes|has|contains|containsKey|hasOwnProperty)\s*\(|\bObject\.hasOwn\s*\(|\(\s*!?\s*\(?\s*[\w.$]+\s+in\s+[\w.$]+\s*\)|\bin\s+(?:\(|\[|\{|[A-Z_]{3,}|self\.[A-Z_]{3,})|\b\w*(?:[aA]llow(?:ed)?[A-Z_]?|ALLOW|[wW]hitelist|WHITELIST|[pP]ermitted|PERMITTED)\w*/;
var reach9 = 30;
var checkReach = 10;
var assignment11 = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring7 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var commentLine22 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation13 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile15 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength19 = 1e3;
var unsafeReflectionRule = {
  id: "unsafe-reflection",
  description: "Flags modules, classes, and methods loaded or called by a name that comes from the request.",
  run({ files, config: config2 }) {
    if (!config2.rules.unsafeReflection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks6.filter((sink) => sink.files.test(file.path));
      if (fileSinks.length === 0 || file.patch === void 0 || documentation13.test(file.path) || skippedFile15.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findCalls(file.patch, file.path, fileSinks);
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const kinds3 = [...new Set(found.map((match2) => match2.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "unsafe-reflection",
          title: "Code chosen by request input",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "load or call code" : "loads or calls code"} by a name that comes from the request (${kinds3.join(", ")}), so a request can pick any module, class, or method the process can reach, such as \`eval\`, \`system\`, or \`constructor\`.`,
          recommendation: "Map the request value to the code it may run with a fixed table, such as `{ csv: CsvExporter, pdf: PdfExporter }[format]`, or check it against a list of allowed names before the call. Never pass request input to `require`, `constantize`, `send`, `getattr`, `Class.forName`, or `call_user_func`."
        }
      ];
    });
  }
};
function findCalls(patch, path2, fileSinks) {
  const isRuby = ruby3.test(path2);
  const isJava = java3.test(path2);
  const fromRequest = (text) => requestValue.test(text) || isRuby && railsParams.test(text) || isJava && servletValue.test(text);
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  const lines = patchLines(patch);
  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength19 || commentLine22.test(content)) {
      return;
    }
    const isTainted = (text) => fromRequest(text) || [...tainted].some(([name, at]) => line - at <= reach9 && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text));
    if (added && !checkedNearby2(lines, index)) {
      for (const sink of fileSinks) {
        for (const match2 of content.matchAll(sink.call)) {
          if (isTainted(nameText(content, match2, sink.argument))) {
            found.push({ line, label: sink.label });
          }
        }
      }
    }
    const names2 = destructuring7.exec(content);
    if (names2 !== null && fromRequest(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment11.exec(content);
    if (single !== null && single[1] !== void 0) {
      const value = single[2] ?? "";
      if (isTainted(value) && !allowlist.test(value)) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  });
  return found;
}
function nameText(content, match2, argument) {
  let text;
  if (argument === "group") {
    text = match2[1] ?? "";
  } else if (argument === "receiver") {
    text = /[^\s=(,]*$/.exec(content.slice(0, match2.index))?.[0] ?? "";
  } else {
    text = splitArguments(content.slice((match2.index ?? 0) + match2[0].length))[argument] ?? "";
  }
  if (/^\s*(?:[fF]?["']|`)[A-Za-z_][\w:-]*(?=[{$"'`]|\s*\+)/.test(text)) {
    return "";
  }
  return text.replace(/([rRbBuUfF]{0,2})(["'])(?:\\.|(?!\2)[^\\])*\2/g, (quoted3) => " ".repeat(quoted3.length));
}
function checkedNearby2(lines, index) {
  for (let other = index; other >= Math.max(0, index - checkReach); other -= 1) {
    if (allowlist.test(lines[other]?.content ?? "")) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  return false;
}

// src/rules/command-injection.ts
var javascript5 = /\.(?:[cm]?[jt]sx?)$/i;
var python5 = /\.py$/i;
var ruby4 = /\.(?:rb|erb|rake)$/i;
var php3 = /\.php$/i;
var java4 = /\.(?:java|kt)$/i;
var sinks7 = [
  {
    label: "child_process",
    files: javascript5,
    call: /(?:(?<![\w$.])|\b(?:child_process|childProcess|cp|shell)\.)(?:exec|execSync|execaCommand|execaCommandSync|spawn|spawnSync|execFile|execFileSync|execa|execaSync)\s*\(/g,
    command: "first"
  },
  { label: "os.system", files: python5, call: /\b(?:os\.(?:system|popen)|commands\.getoutput|subprocess\.(?:getoutput|getstatusoutput))\s*\(/g, command: "first" },
  { label: "subprocess", files: python5, call: /\bsubprocess\.(?:run|call|check_call|check_output|Popen)\s*\(/g, command: "first", shell: /\bshell\s*=\s*True\b/ },
  { label: "system", files: ruby4, call: /(?:(?<![\w.:])|\b(?:Kernel|Process|IO|Open3)\.)(?:system|exec|spawn|popen|capture2e?|capture3|popen2e?|popen3|pipeline\w*)\s*\(?/g, command: "first" },
  { label: "exec", files: php3, call: /(?<![\w>:$])(?:exec|shell_exec|system|passthru|popen|proc_open|pcntl_exec)\s*\(/g, command: "first" },
  { label: "Runtime.exec", files: java4, call: /\.exec\s*\(|\bnew\s+ProcessBuilder\s*\(|\bProcessBuilder\s*\(/g, command: "all" },
  { label: "exec.Command", files: /\.go$/i, call: /\bexec\.Command(?:Context)?\s*\(/g, command: "first" },
  { label: "Process.Start", files: /\.cs$/i, call: /\bProcess\.Start\s*\(|\bArguments\s*=\s*/g, command: "all" }
];
var goShell = /^\s*"(?:[^"]*\/)?(?:sh|bash|zsh|dash|ksh|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh)"\s*$/;
var rubyBackticks = /`([^`]*)`|%x[({[]([^)}\]]*)[)}\]]/g;
var phpBackticks = /`([^`]*)`/g;
var escaped3 = /\b(?:shlex|pipes)\.quote\s*\(|\bescapeshell(?:arg|cmd)\s*\(|\bShellwords\.(?:escape|shellescape|join)\b|\.shellescape\b|\bshell(?:_?[eE]scape|Quote|_quote)\s*\(|\bquote\s*\(\s*\[|\b(?:int|float|parseInt|parseFloat|Number|intval|floatval)\s*\(|\.to_[if]\b|\(int\)|\bInteger\.parseInt\s*\(|\bstrconv\.Atoi\s*\(/;
var assignment12 = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
var destructuring8 = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
var reach10 = 30;
var commentLine23 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation14 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile16 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength20 = 1e3;
var commandInjectionRule = {
  id: "command-injection",
  description: "Flags commands run with a value from the request in the program or the text a shell parses.",
  run({ files, config: config2 }) {
    if (!config2.rules.commandInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks7.filter((sink) => sink.files.test(file.path));
      if (fileSinks.length === 0 || file.patch === void 0 || documentation14.test(file.path) || skippedFile16.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = findCommands(file.patch, file.path, fileSinks);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "command-injection",
          title: "Command built from request input",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "run commands" : "runs a command"} with a value from the request in the program or the text a shell parses, so a request can add \`; rm -rf /\`, \`$(curl ...)\`, or another program and run it on the server.`,
          recommendation: 'Run a fixed program with the request value as a separate argument and no shell, such as `execFile("git", ["log", ref])`, `subprocess.run(["git", "log", ref])`, or `system("git", "log", ref)`, and check the value against the forms it may take. Where a shell is unavoidable, quote the value with `shlex.quote`, `escapeshellarg`, or `Shellwords.escape`.'
        }
      ];
    });
  }
};
function findCommands(patch, path2, fileSinks) {
  const isRuby = ruby4.test(path2);
  const isJava = java4.test(path2);
  const isPhp = php3.test(path2);
  const fromRequest = (text) => requestValue.test(text) || isRuby && railsParams.test(text) || isJava && servletValue.test(text);
  const tainted = /* @__PURE__ */ new Map();
  const found = [];
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength20 || commentLine23.test(content)) {
      continue;
    }
    const isTainted = (text) => !escaped3.test(text) && (fromRequest(text) || [...tainted].some(([name, at]) => line - at <= reach10 && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text)));
    if (added) {
      const reported = fileSinks.some((sink) => [...content.matchAll(sink.call)].some((match2) => runsTainted(content, match2, sink, isTainted))) || isRuby && [...content.matchAll(rubyBackticks)].some((match2) => /#\{/.test(match2[1] ?? match2[2] ?? "") && isTainted(match2[1] ?? match2[2] ?? "")) || isPhp && [...content.matchAll(phpBackticks)].some((match2) => isTainted(match2[1] ?? ""));
      if (reported) {
        found.push(line);
      }
    }
    const names2 = destructuring8.exec(content);
    if (names2 !== null && fromRequest(names2[2] ?? "")) {
      for (const part of (names2[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== void 0) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment12.exec(content);
    if (single !== null && single[1] !== void 0) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  }
  return [...new Set(found)];
}
function runsTainted(content, match2, sink, isTainted) {
  const rest = content.slice((match2.index ?? 0) + match2[0].length);
  const args = splitArguments(rest);
  if (sink.command === "all") {
    return isTainted(args.join(","));
  }
  const first = args[0] ?? "";
  if (sink.label === "exec.Command" && goShell.test(first)) {
    return args.slice(2).some(isTainted);
  }
  if (sink.shell !== void 0 && !sink.shell.test(rest)) {
    return !/^\s*\[/.test(first) && isTainted(first);
  }
  return isTainted(first);
}

// src/rules/weak-password-hashing.ts
var minimum = { bcrypt: 10, pbkdf2: 1e5, scrypt: 16384 };
var names = { bcrypt: "bcrypt cost", pbkdf2: "PBKDF2 iterations", scrypt: "scrypt N" };
var javascript6 = /\.(?:[cm]?[jt]sx?)$/i;
var sinks8 = [
  // bcrypt and bcryptjs.
  { kind: "bcrypt", files: javascript6, call: /\bbcrypt\w*\.(?:hash|hashSync)\s*\(/g, argument: 1 },
  { kind: "bcrypt", files: javascript6, call: /\bbcrypt\w*\.(?:genSalt|genSaltSync)\s*\(/g, argument: 0 },
  { kind: "pbkdf2", files: javascript6, call: /\bpbkdf2(?:Sync)?\s*\(/g, argument: 2 },
  { kind: "scrypt", files: javascript6, call: /\bscrypt(?:Sync)?\s*\(/g, option: /\b(?:N|cost)\s*:\s*/ },
  { kind: "pbkdf2", files: /\.py$/i, call: /\bpbkdf2_hmac\s*\(/g, argument: 3 },
  { kind: "pbkdf2", files: /\.py$/i, call: /\b(?:PBKDF2HMAC|pbkdf2_hmac)\s*\(/g, option: /\biterations\s*=\s*/ },
  { kind: "bcrypt", files: /\.py$/i, call: /\bbcrypt\.gensalt\s*\(/g, argument: 0 },
  { kind: "bcrypt", files: /\.py$/i, call: /\bbcrypt\.gensalt\s*\(/g, option: /\brounds\s*=\s*/ },
  { kind: "scrypt", files: /\.py$/i, call: /\b(?:hashlib\.scrypt|Scrypt)\s*\(/g, option: /\bn\s*=\s*/ },
  { kind: "pbkdf2", files: /\.(?:java|kt)$/i, call: /\bPBEKeySpec\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.(?:java|kt)$/i, call: /\b(?:BCrypt\.gensalt|BCryptPasswordEncoder)\s*\(/g, argument: 0 },
  { kind: "pbkdf2", files: /\.cs$/i, call: /\bRfc2898DeriveBytes(?:\.Pbkdf2)?\s*\(/g, argument: 2 },
  { kind: "pbkdf2", files: /\.cs$/i, call: /\bKeyDerivation\.Pbkdf2\s*\(/g, option: /\biterationCount\s*:\s*/ },
  { kind: "pbkdf2", files: /\.go$/i, call: /\bpbkdf2\.Key\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.go$/i, call: /\bbcrypt\.GenerateFromPassword\s*\(/g, argument: 1 },
  { kind: "scrypt", files: /\.go$/i, call: /\bscrypt\.Key\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.php$/i, call: /\bpassword_hash\s*\(/g, option: /["']cost["']\s*=>\s*/ },
  { kind: "pbkdf2", files: /\.php$/i, call: /\bhash_pbkdf2\s*\(/g, argument: 3 },
  { kind: "bcrypt", files: /\.rb$/i, call: /\bBCrypt::Password\.create\s*\(/g, option: /\bcost:\s*/ },
  { kind: "pbkdf2", files: /\.rb$/i, call: /\bpbkdf2_hmac(?:_sha1)?\s*\(/g, argument: 2 }
];
var namedValues = { "bcrypt.MinCost": 4 };
var numberAssignment = /^\s*(?:(?:export\s+)?(?:const|let|var|final|static|private|public|int|long)\s+)*(?:[\w<>]+\s+)?([A-Za-z_]\w*)\s*(?::\s*\w+\s*)?(?::=|=)\s*([\d_]+(?:\.\d+)?(?:e\d+)?)\s*[;,]?\s*$/i;
var commentLine24 = /^\s*(?:#|\/\/|\/\*|\*)/;
var documentation15 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile17 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var maxLineLength21 = 1e3;
var weakPasswordHashingRule = {
  id: "weak-password-hashing",
  description: "Flags bcrypt, PBKDF2, and scrypt called with a work factor below current advice.",
  run({ files, config: config2 }) {
    if (!config2.rules.weakPasswordHashing.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const fileSinks = sinks8.filter((sink) => sink.files.test(file.path));
      if (fileSinks.length === 0 || file.patch === void 0 || documentation15.test(file.path) || skippedFile17.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findWeakCalls(file.patch, fileSinks);
      if (found.length === 0) {
        return [];
      }
      const lines = [...new Set(found.map((match2) => match2.line))];
      const details = [...new Set(found.map((match2) => `${names[match2.kind]} ${match2.value.toLocaleString("en-US")}, below ${minimum[match2.kind].toLocaleString("en-US")}`))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "weak-password-hashing",
          title: "Password hashed with too little work",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "hash passwords or derive keys" : "hashes a password or derives a key"} with too little work (${details.join("; ")}), so a leaked hash can be guessed far faster on a GPU.`,
          recommendation: "Use a bcrypt cost of at least 10, at least 600,000 PBKDF2-SHA256 iterations, or scrypt with N of at least 2^14, or switch to Argon2id. Raise the cost again as hardware gets faster, and rehash passwords at the next login."
        }
      ];
    });
  }
};
function findWeakCalls(patch, fileSinks) {
  const constants = new Map(Object.entries(namedValues));
  const found = [];
  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength21 || commentLine24.test(content)) {
      continue;
    }
    const assigned = numberAssignment.exec(content);
    if (assigned?.[1] !== void 0) {
      constants.set(assigned[1], Number((assigned[2] ?? "").replace(/_/g, "")));
    }
    if (!added) {
      continue;
    }
    for (const sink of fileSinks) {
      for (const match2 of content.matchAll(sink.call)) {
        const rest = content.slice((match2.index ?? 0) + match2[0].length);
        const text = sink.argument !== void 0 ? splitArguments(rest)[sink.argument] : optionValue(rest, sink.option);
        const value = numberOf(text ?? "", constants);
        if (value !== void 0 && value < minimum[sink.kind]) {
          found.push({ line, kind: sink.kind, value });
        }
      }
    }
  }
  return found;
}
function optionValue(rest, option2) {
  if (option2 === void 0) {
    return void 0;
  }
  const args = splitArguments(rest).join(",");
  const match2 = option2.exec(args);
  return match2 === null ? void 0 : args.slice(match2.index + match2[0].length).split(/[,)}\]]/)[0];
}
function numberOf(text, constants) {
  const value = text.trim();
  const literal3 = /^([\d_]+(?:\.\d+)?(?:e\d+)?)$/i.exec(value);
  if (literal3 !== null) {
    return Number((literal3[1] ?? "").replace(/_/g, ""));
  }
  const power = /^(\d+)\s*\*\*\s*(\d+)$/.exec(value);
  if (power !== null) {
    return Number(power[1]) ** Number(power[2]);
  }
  const shift = /^(\d+)\s*<<\s*(\d+)$/.exec(value);
  if (shift !== null) {
    return Number(shift[1]) * 2 ** Number(shift[2]);
  }
  return constants.get(value);
}

// src/security/session-secrets.ts
var assignments = [
  // Flask and Django.
  {
    files: /\.py$/i,
    setting: /^\s*(?:(?:app|application)\.secret_key\s*=|(?:app|application)\.config\s*\[\s*["']SECRET_KEY["']\s*\]\s*=|SECRET_KEY\s*=|.*\bSECRET_KEY\s*=(?!=))\s*/
  },
  // Rails, Sinatra, and Rack.
  {
    files: /\.(?:rb|ru)$/i,
    setting: /\b(?:config\.secret_key_base|config\.secret_token|secret_key_base:|set\s+:session_secret,|Rack::Session::Cookie,.*\bsecret:)\s*=?\s*/
  },
  // Rails' config/secrets.yml and Phoenix's config/*.exs.
  { files: /\.(?:ya?ml|exs?)$/i, setting: /^\s*secret_key_base\s*:\s*/ },
  // Koa's `app.keys = ["..."]` and cookie-parser's `cookieParser("...")`.
  { files: /\.(?:[cm]?[jt]sx?)$/i, setting: /\bapp\.keys\s*=\s*\[\s*|\bcookieParser\s*\(\s*\[?\s*/ },
  // gorilla/sessions, gin-contrib/sessions, and securecookie.
  { files: /\.go$/i, setting: /\b(?:sessions\.NewCookieStore|cookie\.NewStore|securecookie\.New|sessions\.NewFilesystemStore\s*\([^,]*,)\s*\(\s*\[\]byte\s*\(\s*/ }
];
var sessionCall = /\b(?:session|expressSession|cookieSession|koaSession|fastifySession|fastifySecureSession|ironSession|getIronSession|withIronSessionApiRoute|sealData)\s*\(|\bregister\s*\(\s*(?:fastifyCookie|fastifySession|fastifySecureSession|require\(\s*["']@fastify\/(?:cookie|session|secure-session)["']\s*\))|\b(?:sessionOptions|ironOptions)\s*(?::\s*\w+\s*)?=\s*\{/;
var optionKey = /\b(?:secret|keys|password)\s*:\s*\[?\s*/;
var optionsReach = 15;
var literal2 = /^(?:[bBrRuU]{1,2})?(["'`])((?:\\.|(?!\1).)+)\1/;
var placeholder2 = /\{\{|\{%|<%|\$\{|^\s*$/;
var commentLine25 = /^\s*(?:#|\/\/|\/\*|\*)/;
var maxLineLength22 = 1e3;
function findSessionSecretLines(path2, patch) {
  const fileAssignments = assignments.filter(({ files }) => files.test(path2));
  const javascript8 = /\.(?:[cm]?[jt]sx?)$/i.test(path2);
  if (fileAssignments.length === 0) {
    return [];
  }
  const python6 = /\.py$/i.test(path2);
  const found = [];
  let optionsLeft = 0;
  let depth = 0;
  let inDocstring = false;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      optionsLeft = 0;
      inDocstring = false;
    }
    const wasInDocstring = inDocstring;
    if (python6 && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
      inDocstring = !inDocstring;
    }
    if (content.length > maxLineLength22 || commentLine25.test(content) || wasInDocstring) {
      continue;
    }
    const call = javascript8 ? sessionCall.exec(content) : null;
    if (call !== null) {
      optionsLeft = optionsReach;
      depth = 0;
    }
    const assigned = fileAssignments.some(({ setting }) => {
      const match2 = setting.exec(content);
      return match2 !== null && !insideString(content, match2.index) && isLiteral(content.slice(match2.index + match2[0].length));
    });
    const inOptions = optionsLeft > 0 && (() => {
      const match2 = optionKey.exec(content);
      return match2 !== null && isLiteral(content.slice(match2.index + match2[0].length));
    })();
    if (added && (assigned || inOptions)) {
      found.push(line);
    }
    if (optionsLeft > 0) {
      const text = call === null ? content : content.slice(call.index);
      const opened = depth > 0 || text.includes("{");
      depth += (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length;
      optionsLeft = opened && depth <= 0 ? 0 : optionsLeft - 1;
    }
  }
  return found;
}
function insideString(content, index) {
  let quote;
  for (let position = 0; position < index; position += 1) {
    const char = content[position];
    if (quote !== void 0) {
      if (char === "\\") {
        position += 1;
      } else if (char === quote) {
        quote = void 0;
      }
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    }
  }
  return quote !== void 0;
}
function isLiteral(value) {
  const match2 = literal2.exec(value.trim());
  return match2 !== null && !placeholder2.test(match2[2] ?? "");
}

// src/rules/hardcoded-session-secret.ts
var documentation16 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var sampleDirectory = /(?:^|\/)(?:examples?|samples?|demos?|docs?)\//i;
var hardcodedSessionSecretRule = {
  id: "hardcoded-session-secret",
  description: "Flags session and cookie signing keys written in the code.",
  run({ files, config: config2 }) {
    if (!config2.rules.hardcodedSessionSecret.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (documentation16.test(file.path) || sampleDirectory.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = sessionSecretLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "hardcoded-session-secret",
          title: "Session key written in the code",
          severity: "high",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "set" : "sets"} the key that signs session cookies to text written in the code, so anyone who can read the code can make a cookie for any user. With Flask, Django, and Rails, which unpickle or unmarshal some signed data, that can also mean running code on the server.`,
          recommendation: 'Load the key from a secret store or an environment variable, such as `process.env.SESSION_SECRET`, `os.environ["SECRET_KEY"]`, or Rails credentials, and replace the key that was committed, which signs out every user.'
        }
      ];
    });
  }
};
function sessionSecretLines(file) {
  if (file.sessionSecretLines !== void 0) {
    return file.sessionSecretLines;
  }
  return file.patch === void 0 ? [] : findSessionSecretLines(file.path, file.patch);
}

// src/security/jwt-expiry.ts
var javascript7 = /\.(?:[cm]?[jt]sx?)$/i;
var signers = [
  // jsonwebtoken: jwt.sign(payload, key, { expiresIn }) or an `exp` claim.
  { files: javascript7, call: /\bjwt\.sign\s*\(/g, claims: 0, options: 2, expiry: /\b(?:exp|expiresIn)\b\s*:/ },
  // jose: new SignJWT(claims).setExpirationTime(...).sign(key).
  { files: javascript7, call: /\bnew\s+SignJWT\s*\(/g, chainEnd: /\.sign\s*\(/, expiry: /\.setExpirationTime\s*\(|\bexp\s*:/ },
  // PyJWT and ruby-jwt take the claims as the first argument.
  { files: /\.py$/i, call: /\bjwt\.encode\s*\(/g, claims: 0, expiry: /["']exp["']\s*:|\bexp\s*=/ },
  { files: /\.rb$/i, call: /\bJWT\.encode\s*\(/g, claims: 0, expiry: /\bexp:|["']exp["']\s*=>|:exp\s*=>/ },
  // golang-jwt: jwt.NewWithClaims(method, jwt.MapClaims{...}) or RegisteredClaims{ExpiresAt: ...}.
  { files: /\.go$/i, call: /\bjwt\.NewWithClaims\s*\(/g, claims: 1, expiry: /"exp"\s*:|\bExpiresAt\s*:/ },
  // jjwt and Auth0's java-jwt build the token with chained calls.
  { files: /\.(?:java|kt)$/i, call: /\bJwts\.builder\s*\(\s*\)/g, chainEnd: /\.compact\s*\(/, expiry: /\.(?:setExpiration|expiration)\s*\(|\.claim\s*\(\s*"exp"/ },
  { files: /\.(?:java|kt)$/i, call: /\bJWT\.create\s*\(\s*\)/g, chainEnd: /\.sign\s*\(/, expiry: /\.withExpiresAt\s*\(|\.withClaim\s*\(\s*"exp"/ },
  // .NET: new JwtSecurityToken(..., expires: ...) or a SecurityTokenDescriptor with Expires.
  { files: /\.cs$/i, call: /\bnew\s+JwtSecurityToken\s*\(/g, chainEnd: /\)\s*;/, expiry: /\bexpires\s*:/ },
  { files: /\.cs$/i, call: /\bnew\s+SecurityTokenDescriptor\b/g, chainEnd: /\}\s*;/, expiry: /\bExpires\s*=/ }
];
var reach11 = 15;
var objectLiteral = /^\s*(?:&?(?:jwt\.)?(?:MapClaims|RegisteredClaims|\w*Claims)\s*)?\{[\s\S]*\}\s*$/;
var commentLine26 = /^\s*(?:#|\/\/|\/\*|\*|>>>)/;
var maxLineLength23 = 1e3;
var mentionsJwt2 = /jwt|JWT|Jwt|SignJWT|SecurityTokenDescriptor/;
var header = /["']alg["']\s*:/;
function findJwtWithoutExpiryLines(path2, patch) {
  const fileSigners = signers.filter((signer) => signer.files.test(path2));
  if (fileSigners.length === 0) {
    return [];
  }
  return findTokensWithoutExpiry(patchLines(patch), fileSigners);
}
function findTokensWithoutExpiry(lines, fileSigners) {
  const found = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength23 || commentLine26.test(content) || !mentionsJwt2.test(content)) {
      return;
    }
    const following = [];
    for (const next of lines.slice(index + 1, index + reach11)) {
      if (next.startsHunk) {
        break;
      }
      following.push(next.content);
    }
    const text = [content, ...following].join("\n");
    for (const signer of fileSigners) {
      for (const match2 of content.matchAll(signer.call)) {
        const rest = text.slice((match2.index ?? 0) + match2[0].length);
        if (lacksExpiry(signer, rest)) {
          found.push(line);
        }
      }
    }
  });
  return [...new Set(found)];
}
function lacksExpiry(signer, rest) {
  if (signer.chainEnd !== void 0) {
    const end = rest.search(signer.chainEnd);
    return end !== -1 && !signer.expiry.test(rest.slice(0, end));
  }
  const args = splitArguments(rest);
  const claims = args[signer.claims ?? 0] ?? "";
  if (!objectLiteral.test(claims) || signer.expiry.test(claims) || header.test(claims)) {
    return false;
  }
  if (signer.options === void 0) {
    return true;
  }
  const options = args[signer.options];
  if (options === void 0 || options.trim() === "") {
    return true;
  }
  return objectLiteral.test(options) && !signer.expiry.test(options);
}

// src/rules/jwt-without-expiry.ts
var documentation17 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var skippedFile18 = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
var jwtWithoutExpiryRule = {
  id: "jwt-without-expiry",
  description: "Flags JSON Web Tokens issued without an expiry.",
  run({ files, config: config2 }) {
    if (!config2.rules.jwtWithoutExpiry.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation17.test(file.path) || skippedFile18.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = jwtExpiryLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "jwt-without-expiry",
          title: "JWT issued without an expiry",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "issue JSON Web Tokens" : "issues a JSON Web Token"} without an expiry, so a token that leaks, through a log, a browser, or a former employee, works for as long as the signing key does, and cannot be revoked without changing it.`,
          recommendation: 'Give each token a short lifetime, such as `expiresIn: "15m"` with jsonwebtoken, `setExpirationTime("15m")` with jose, or an `exp` claim, and use refresh tokens that the server can revoke for longer sessions.'
        }
      ];
    });
  }
};
function jwtExpiryLines(file) {
  if (file.jwtExpiryLines !== void 0) {
    return file.jwtExpiryLines;
  }
  return file.patch === void 0 ? [] : findJwtWithoutExpiryLines(file.path, file.patch);
}

// src/rules/dependency-risk.ts
var ecosystemHints = [
  [/package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock/, "Node.js"],
  [/requirements\.txt|pyproject\.toml|poetry\.lock/, "Python"],
  [/go\.(mod|sum)/, "Go"],
  [/Cargo\.(toml|lock)/, "Rust"]
];
var dependencyRiskRule = {
  id: "dependency-risk",
  description: "Flags dependency manifest and lockfile changes for supply-chain review.",
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.dependencyRisk;
    if (!ruleConfig.enabled) {
      return [];
    }
    return files.filter((file) => ruleConfig.manifests.some((pattern) => minimatch(file.path, pattern, { matchBase: true }))).map((file) => {
      const ecosystem = detectEcosystem(file.path);
      return {
        ruleId: "dependency-risk",
        title: "Dependency definition changed",
        severity: "warning",
        file: file.path,
        message: `This file changes ${ecosystem} dependency metadata or lockfile state.`,
        recommendation: "Verify package provenance, lockfile consistency, license impact, and whether the dependency is required at runtime."
      };
    });
  }
};
function detectEcosystem(path2) {
  const match2 = ecosystemHints.find(([pattern]) => pattern.test(path2));
  return match2?.[1] ?? "project";
}

// src/rules/destructive-migration.ts
var kinds = [
  {
    kind: "drops a table",
    destructive: true,
    pattern: /\bdrop\s+(?:table|schema|database)\b|(?<![\w:])(?:drop_table|drop_join_table|dropTable|dropTableIfExists|DropTable|DeleteModel(?=\s*\())|\bSchema::drop(?:IfExists)?\s*\(/i
  },
  {
    kind: "drops a column",
    destructive: true,
    pattern: /\bdrop\s+column\b|\balter\s+table\b.{0,300}?\bdrop\s+(?!(?:column|constraint|index|key|primary|foreign|check|default|not|partition|identity|expression|period|system|table|trigger)\b)["`[]?\w|(?<![\w:])(?:remove_columns?|remove_reference|remove_belongs_to|remove_timestamps|drop_column|dropColumns?|DropColumn|removeColumn|RemoveField(?=\s*\())|^\s*remove\s+:/i
  },
  {
    kind: "removes every row",
    destructive: true,
    pattern: /\btruncate\s+table\b|^\s*truncate\s+["`[]?\w|\bdelete\s+from\s+[\w."`[\]]+\s*;|\.truncate\s*\(\s*\)/i
  },
  {
    kind: "changes a column definition",
    destructive: false,
    pattern: /\balter\s+column\s+["`[]?[\w.]+["`\]]?\s+(?!(?:set|drop|add|reset|restart|options)\b)\w|\b(?:modify|change)\s+column\b|(?<![\w:])(?:change_column(?!_)|changeColumn|AlterColumn)\b|->change\s*\(\s*\)|\.alter\s*\(\s*\)|\balter_column\s*\([^)]*\btype_\s*=|^\s*modify\s+:/i
  },
  {
    kind: "renames a table or column",
    destructive: false,
    pattern: /\brename\s+(?:(?:column|table)\s+)?(?:[\w."`[\]]+\s+)?to\b|\bsp_rename\b|(?<![\w:])(?:rename_table|rename_column|renameTable|renameColumn|RenameTable|RenameColumn|RenameField(?=\s*\()|RenameModel(?=\s*\())|\bSchema::rename\s*\(|^\s*rename\s+table\s*\(|\balter_column\s*\([^)]*\bnew_column_name\s*=/i
  }
];
var migrationPath = /(?:^|\/)[^/]*(?:migrat|alembic)[^/]*\/|(?:^|\/)(?:V\d[^/]*__[^/]*|[^/]*\.up)\.sql$/i;
var migrationFile = /\.(?:sql|rb|py|[cm]?[jt]s|php|cs|go|java|kt|exs?)$/i;
var migrationName = /(?:^|\/)versions\/[^/]+$|(?:^|\/)[Vv]?\d[^/]*$/;
var rollbackFile = /(?:^|[._/-])down\.sql$|(?:^|\/)U\d[^/]*__[^/]*\.sql$/i;
var rollbackStart = /^\s*(?:def\s+(?:self\.)?down(?:grade)?\b|(?:(?:public|protected|private|internal|override|static|async|export|function|void)\s+)*[Dd]own\s*\(|(?:module\.)?exports\.down\s*=|down\s*:\s*(?:async\s*)?(?:function\b|\()|func\s+(?:[Dd]own\w*|\w*Down\w*)\s*\()|^\s*--\s*(?:\+(?:goose|migrate)\s+down|migrate:down)\b/i;
var forwardStart = /^\s*(?:def\s+(?:self\.)?(?:up(?:grade)?|change)\b|(?:(?:public|protected|private|internal|override|static|async|export|function|void)\s+)*[Uu]p\s*\(|(?:module\.)?exports\.up\s*=|up\s*:\s*(?:async\s*)?(?:function\b|\()|func\s+(?:[Uu]p\w*|\w*Up\w*)\s*\()|^\s*--\s*(?:\+(?:goose|migrate)\s+up|migrate:up)\b/i;
var commentLine27 = /^\s*(?:--|#|\/\/|\/\*|\*)/;
var operationDefinition = /^\s*(?:class|def|module|raise|throw)\s/;
var definition = /^(\s*)(?:(?:public|protected|private|internal|override|static|async|export|void)\s+)*(?:def\s+(?:self\.)?|function\s+|func\s+(?:\([^)]*\)\s*)?)(\w+)/;
var destructiveMigrationRule = {
  id: "destructive-migration",
  description: "Flags migrations that drop tables or columns, delete every row, or rename or redefine columns.",
  run({ files, config: config2 }) {
    if (!config2.rules.destructiveMigration.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !migrationPath.test(file.path) || !migrationFile.test(file.path) || !/\.sql$/i.test(file.path) && !migrationName.test(file.path) || rollbackFile.test(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findChanges(file.path, file.patch);
      if (found.length === 0) {
        return [];
      }
      const listed = kinds.filter(({ kind }) => found.some((match2) => match2.kind === kind));
      const destructive = listed.some((entry) => entry.destructive);
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const many = plural || listed.length > 1;
      return [
        {
          ruleId: "destructive-migration",
          title: destructive ? "Destructive migration added" : "Breaking schema change added",
          severity: destructive ? "high" : "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "change" : "changes"} the database in ${many ? "ways that are" : "a way that is"} hard to undo: ${listed.map((entry) => entry.kind).join(", ")}.`,
          recommendation: "Back up the affected data and deploy in steps: stop using the table or column in one release, then drop or rename it in a later one, so running code does not break. Check that the migration can be rolled back."
        }
      ];
    });
  }
};
function findChanges(path2, patch) {
  const found = [];
  const sql = /\.sql$/i.test(path2);
  let rollbackIndent;
  let inBlockComment = false;
  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    if (startsHunk) {
      rollbackIndent = rollbackStart.test(hunkContext ?? "") ? indentation(hunkContext ?? "") : void 0;
      inBlockComment = false;
    }
    const defined = definition.exec(content);
    if (rollbackStart.test(content)) {
      rollbackIndent = indentation(content);
    } else if (forwardStart.test(content) || defined && rollbackIndent !== void 0 && (defined[1] ?? "").length <= rollbackIndent) {
      rollbackIndent = void 0;
    }
    let code = content;
    if (sql) {
      ({ code, inBlockComment } = stripSqlComments(content, inBlockComment));
    }
    if (!added || rollbackIndent !== void 0 || commentLine27.test(code) || operationDefinition.test(code)) {
      continue;
    }
    for (const { kind, pattern } of kinds) {
      if (pattern.test(code)) {
        found.push({ line, kind });
      }
    }
  }
  return found;
}
function indentation(text) {
  return /^\s*/.exec(text)?.[0].length ?? 0;
}
function stripSqlComments(content, inBlockComment) {
  let code = "";
  let rest = content;
  while (rest.length > 0) {
    if (inBlockComment) {
      const end = rest.indexOf("*/");
      if (end < 0) {
        break;
      }
      inBlockComment = false;
      rest = rest.slice(end + 2);
      continue;
    }
    const lineComment = rest.indexOf("--");
    const blockComment = rest.indexOf("/*");
    if (lineComment >= 0 && (blockComment < 0 || lineComment < blockComment)) {
      code += rest.slice(0, lineComment);
      break;
    }
    if (blockComment < 0) {
      code += rest;
      break;
    }
    code += `${rest.slice(0, blockComment)} `;
    inBlockComment = true;
    rest = rest.slice(blockComment + 2);
  }
  return { code, inBlockComment };
}

// src/rules/disabled-security-check.ts
var word = (...parts) => new RegExp(`(?:^|[^\\w@-])${parts.join("")}\\b`);
var insecureKubeFlag = ["--insecure", "-skip-tls-verify"].join("");
var pythonVerifyOff = /(?:[(,]\s*|^\s*|\b\w*session\.)verify\s*=\s*False\b(?!\s*[^\s,)#])/;
var localUrl = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])\b/;
var tls = {
  label: "TLS certificate verification",
  high: true,
  patterns: [
    /\brejectUnauthorized\s*:\s*false\b/,
    /\bNODE_TLS_REJECT_UNAUTHORIZED\b["']?\s*[:=]\s*["']?0\b/,
    /\bstrict-ssl\b["']?\s*[=:\s]\s*["']?false\b/,
    pythonVerifyOff,
    /\bssl\._create_unverified_context\b|\bcheck_hostname\s*=\s*False\b|\bPYTHONHTTPSVERIFY\b["']?\s*[:=]\s*["']?0\b/,
    word("CERT", "_NONE"),
    word("VERIFY", "_NONE"),
    /\bInsecureSkipVerify\s*:\s*true\b/,
    word("Noop", "HostnameVerifier"),
    word("ALLOW_ALL", "_HOSTNAME_VERIFIER"),
    word("TrustAll", "Strategy"),
    /\bServerCertificate(?:Custom)?ValidationCallback\s*\+?=\s*[^;]{0,300}=>\s*true\b/,
    word("DangerousAcceptAny", "ServerCertificateValidator"),
    /\bCURLOPT_SSL_VERIFY(?:PEER|HOST)\b\s*(?:=>|,)\s*(?:false|0)\b|['"]verify['"]\s*=>\s*false\b/,
    // `curl -k`, `curl -fsSLk`, `curl --insecure`
    /\bcurl\b[^|;&\n]{0,2000}\s(?:-[a-zA-Z]*k[a-zA-Z]*|--insecure)(?=\s|$)/,
    /\bwget\s[^|;&\n]{0,2000}--no-check-certificate\b/,
    /\bhttp\.sslVerify\b["']?\s*[=\s]\s*["']?false\b|\bGIT_SSL_NO_VERIFY\b["']?\s*[:=]\s*["']?(?:1|true)\b/,
    /\binsecure-skip-tls-verify["']?\s*:\s*["']?true\b/,
    new RegExp(`${insecureKubeFlag}(?:=true)?(?=\\s|$)`)
  ]
};
var token = {
  label: "token signature or expiry checks",
  high: true,
  patterns: [
    /["']?verify_(?:signature|exp)["']?\s*:\s*False\b/,
    /\bignoreExpiration\s*:\s*true\b/,
    /\balgorithms["']?\s*[:=]\s*\[\s*["']none["']/i,
    /\bParseUnverified\s*\(/
  ]
};
var csrf = {
  label: "CSRF protection",
  high: false,
  patterns: [
    /\bcsrf\(\)\s*\.disable\(\)|\bcsrf\(\s*(?:AbstractHttpConfigurer::disable|\w+\s*->\s*\w+\.disable\(\))\s*\)/,
    word("@csrf", "_exempt"),
    /\bcsrf\.exempt\b|\bWTF_CSRF_ENABLED\s*=\s*False\b/,
    /\bskip_before_action\s+:verify_authenticity_token\b/,
    word("skip_forgery", "_protection")
  ]
};
var checks = [tls, token, csrf];
var commentLine28 = /^\s*(?:#|\/\/|\/\*|\*)/;
var importLine2 = /^\s*(?:from\s+[\w.]+\s+import|import)\b/;
var definitionLine = /^\s*(?:func\s|(?:(?:public|protected|private|internal|abstract|final|static|sealed|open|data)\s+)*(?:class|interface|enum|record|object)\s+\w)/;
var documentation18 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var disabledSecurityCheckRule = {
  id: "disabled-security-check",
  description: "Flags code that turns off TLS certificate verification, token signature checks, or CSRF protection.",
  run({ files, config: config2 }) {
    if (!config2.rules.disabledSecurityChecks.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation18.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = addedLines(file.patch).flatMap(
        ({ line, content }) => commentLine28.test(content) || importLine2.test(content) || definitionLine.test(content) ? [] : checksIn(content).map((check) => ({ line, check }))
      );
      if (found.length === 0) {
        return [];
      }
      const listed = checks.filter((check) => found.some((match2) => match2.check === check));
      const high = listed.some((check) => check.high);
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const labels14 = listed.map((check) => check.label);
      return [
        {
          ruleId: "disabled-security-check",
          title: "Security check turned off",
          severity: high ? "high" : "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "turn off security checks" : listed.length > 1 ? "turns off security checks" : "turns off a security check"}: ${joinLabels2(labels14)}.`,
          recommendation: "Keep these checks on outside local development. Trust a private certificate authority by adding its certificate rather than turning verification off, verify tokens with the expected algorithm, and exempt from CSRF only endpoints that authenticate another way, such as signed webhooks."
        }
      ];
    });
  }
};
function checksIn(content) {
  const matched = checks.filter(
    (check) => check.patterns.some((pattern) => pattern.test(content)) && !(check === tls && isLocalDownload(content))
  );
  return matched.includes(tls) && /\bjwt\b/i.test(content) && pythonVerifyOff.test(content) ? [...new Set(matched.map((check) => check === tls ? token : check))] : matched;
}
function isLocalDownload(content) {
  return /\b(?:curl|wget)\b/.test(content) && localUrl.test(content);
}
function joinLabels2(labels14) {
  return labels14.length > 1 ? `${labels14.slice(0, -1).join(", ")}, and ${labels14.at(-1)}` : labels14[0] ?? "";
}

// src/analysis/hidden-characters.ts
var bidiControls = /* @__PURE__ */ new Map([
  [8234, "LEFT-TO-RIGHT EMBEDDING"],
  [8235, "RIGHT-TO-LEFT EMBEDDING"],
  [8236, "POP DIRECTIONAL FORMATTING"],
  [8237, "LEFT-TO-RIGHT OVERRIDE"],
  [8238, "RIGHT-TO-LEFT OVERRIDE"],
  [8294, "LEFT-TO-RIGHT ISOLATE"],
  [8295, "RIGHT-TO-LEFT ISOLATE"],
  [8296, "FIRST STRONG ISOLATE"],
  [8297, "POP DIRECTIONAL ISOLATE"]
]);
var invisibleCharacters = /* @__PURE__ */ new Map([
  [8203, "ZERO WIDTH SPACE"],
  [8288, "WORD JOINER"],
  [8289, "FUNCTION APPLICATION"],
  [8290, "INVISIBLE TIMES"],
  [8291, "INVISIBLE SEPARATOR"],
  [8292, "INVISIBLE PLUS"],
  [65279, "ZERO WIDTH NO-BREAK SPACE"],
  [4447, "HANGUL CHOSEONG FILLER"],
  [4448, "HANGUL JUNGSEONG FILLER"],
  [12644, "HANGUL FILLER"],
  [65440, "HALFWIDTH HANGUL FILLER"]
]);
var byteOrderMark = 65279;
function isHiddenCodePoint(codePoint) {
  return bidiControls.has(codePoint) || invisibleCharacters.has(codePoint) || isTagCharacter(codePoint);
}
function findHiddenCharacters(text, allowLeadingBom = false) {
  const labels14 = /* @__PURE__ */ new Set();
  let reordersText = false;
  let index = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const atStart = index === 0;
    index += 1;
    if (codePoint === byteOrderMark && atStart && allowLeadingBom) {
      continue;
    }
    const bidiName = bidiControls.get(codePoint);
    if (bidiName) {
      labels14.add(`${formatCodePoint(codePoint)} ${bidiName}`);
      reordersText = true;
    } else if (invisibleCharacters.has(codePoint)) {
      labels14.add(`${formatCodePoint(codePoint)} ${invisibleCharacters.get(codePoint)}`);
    } else if (isTagCharacter(codePoint)) {
      labels14.add("Unicode tag characters");
    }
  }
  return { labels: [...labels14], reordersText };
}
function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}
function isTagCharacter(codePoint) {
  return codePoint >= 917504 && codePoint <= 917631;
}
function findHiddenLines(patch) {
  return addedLines(patch).map(({ line, content }) => ({ line, ...findHiddenCharacters(content, line === 1) })).filter((found) => found.labels.length > 0);
}

// src/rules/hidden-unicode.ts
var effect = "characters that are invisible or reorder text";
var translationCatalog = /\.(?:po|pot|xlf|xliff|strings|stringsdict|arb)$/i;
var tagLabel = "Unicode tag characters";
var hiddenUnicodeRule = {
  id: "hidden-unicode",
  seesIgnoredFiles: true,
  description: "Flags added bidirectional controls and invisible characters that hide or reorder text.",
  run({ files, config: config2 }) {
    if (!config2.rules.hiddenUnicode.enabled) {
      return [];
    }
    return files.flatMap((file) => {
      const inPath = findHiddenCharacters(file.path);
      const translation = translationCatalog.test(file.path);
      const inLines = (file.hiddenLines ?? findHiddenLines(file.patch ?? "")).filter((found) => !translation || found.labels.includes(tagLabel)).map((found) => ({ line: found.line, found }));
      if (inPath.labels.length === 0 && inLines.length === 0) {
        return [];
      }
      const sentences = [];
      if (inPath.labels.length > 0) {
        sentences.push(
          `The file name contains ${effect} (${inPath.labels.join(", ")}), so it can display as a different name.`
        );
      }
      if (inLines.length > 0) {
        const { text, plural } = describeLines(inLines.map(({ line }) => line));
        const labels14 = [...new Set(inLines.flatMap(({ found }) => found.labels))];
        sentences.push(
          `${text} ${plural ? "contain" : "contains"} ${effect} (${labels14.join(", ")}), so the code can read differently from how it runs.`
        );
      }
      const reordersText = inPath.reordersText || inLines.some(({ found }) => found.reordersText);
      return [
        {
          ruleId: "hidden-unicode",
          title: "Hidden Unicode characters added",
          severity: reordersText ? "high" : "warning",
          file: file.path,
          ...inLines.length > 0 ? { line: Math.min(...inLines.map(({ line }) => line)) } : {},
          message: sentences.join(" "),
          recommendation: "Remove the characters, or write them as escape sequences if they are intended, and check the change in an editor that shows control characters."
        }
      ];
    });
  }
};

// src/rules/incomplete-review.ts
var incompleteReviewRule = {
  id: "incomplete-review",
  description: "Flags pull requests with more changed files than GitHub returned for review.",
  seesIgnoredFiles: true,
  run({ files, expectedFileCount }) {
    if (expectedFileCount === void 0 || expectedFileCount <= files.length || files.length < pullRequestFileLimit) {
      return [];
    }
    return [
      {
        ruleId: "incomplete-review",
        title: "Pull request too large to review fully",
        severity: "high",
        message: `This pull request changes ${expectedFileCount} files, but GitHub returned ${files.length}, so ${expectedFileCount - files.length} files were not reviewed.`,
        recommendation: "Split the pull request, or review the remaining files another way, for example with the CLI on the full git diff."
      }
    ];
  }
};

// src/rules/large-diff.ts
var largeDiffRule = {
  id: "large-diff",
  description: "Flags pull requests that exceed configured file or line thresholds.",
  run({ files, config: config2 }) {
    const maxFiles = config2.risk.largeDiff.maxFiles;
    const maxChangedLines = config2.risk.largeDiff.maxChangedLines;
    const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
    if (files.length <= maxFiles && totalChangedLines <= maxChangedLines) {
      return [];
    }
    return [
      {
        ruleId: "large-diff",
        title: "Large pull request",
        severity: "warning",
        message: `This PR changes ${files.length} file(s) and ${totalChangedLines} line(s), which exceeds the configured review threshold.`,
        recommendation: "Consider splitting the change or adding a clear reviewer guide that explains the intended review order."
      }
    ];
  }
};

// src/security/lockfile-sources.ts
var defaultAllowedSources = [
  "https://registry.npmjs.org/",
  "https://registry.yarnpkg.com/",
  "https://pypi.org/",
  "https://files.pythonhosted.org/",
  "https://rubygems.org/",
  "https://index.crates.io/",
  "https://static.crates.io/",
  "https://github.com/rust-lang/crates.io-index"
];
var gitHosts = /^(?:github\.com|codeload\.github\.com|gitlab\.com|bitbucket\.org)$/i;
var quotedUrl = (key) => new RegExp(`${key}["']?\\s*[:=]\\s*["']?([a-z][\\w+.-]*:\\/\\/[^\\s"'#,}]+)`, "i");
var firstUrl = (pattern) => (content) => {
  const url = pattern.exec(content)?.[1];
  return url === void 0 ? [] : [{ url }];
};
var readers = [
  // npm's `"resolved": "..."` (`"version"` in lockfile v1), yarn v1's `resolved "..."`, yarn berry's
  // `resolution: "pkg@https://..."`, and pnpm's `tarball: ...` and `repo: ...`.
  {
    files: /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
    urls: firstUrl(/\b(?:resolved|resolution|tarball|repo|version)["']?\s*[:\s]\s*\{?\s*["']?(?:@?[^"'\s@]+@)?((?:git\+)?[a-z][\w+.-]*:\/\/[^\s"'#,}]+)/i)
  },
  { files: /(?:^|\/)poetry\.lock$/i, urls: firstUrl(quotedUrl("url")) },
  { files: /(?:^|\/)Pipfile(?:\.lock)?$/i, urls: firstUrl(quotedUrl("url")) },
  {
    files: /(?:^|\/)pyproject\.toml$/i,
    urls: (content, section) => {
      const entries = [];
      const direct = /["']\s*[\w.-]+(?:\[[^\]]{0,200}\])?\s*@\s*((?:git\+)?[a-z][\w+.-]*:\/\/[^"'\s;]+)/i.exec(content);
      if (direct) {
        entries.push({ url: direct[1] ?? "" });
      }
      const index = /^\s*(index-url|extra-index-url)\s*=\s*\[?\s*["']([^"']+)["']/i.exec(content);
      if (index) {
        entries.push({ url: index[2] ?? "", extraIndex: /extra/i.test(index[1] ?? "") });
      }
      const sourceUrl = /^\s*url\s*=\s*["']([^"']+)["']/i.exec(content);
      if (sourceUrl && /^tool\.(?:poetry\.source|uv\.index|pdm\.source)$/i.test(section)) {
        entries.push({ url: sourceUrl[1] ?? "" });
      }
      const inline = /\{[^{}]{0,300}?\b(git|url)\s*=\s*"([^"]{1,500})"/i.exec(content);
      if (inline) {
        entries.push({ url: inline[2] ?? "", git: inline[1]?.toLowerCase() === "git" });
      }
      return entries;
    }
  },
  {
    // `source = { registry = "..." }`, `sdist = { url = "..." }`, and `source = { git = "..." }`.
    files: /(?:^|\/)uv\.lock$/i,
    urls: (content) => [...content.matchAll(/\b(registry|url|git)\s*=\s*"([^"]+)"/gi)].map(([, key, url]) => ({
      url: url ?? "",
      git: key?.toLowerCase() === "git"
    }))
  },
  {
    // `old => new version` replaces a module; a local path or the same module path is routine.
    files: /(?:^|\/)go\.mod$/i,
    urls: (content) => {
      const replace = /^\s*(?:replace\s+)?(\S+)(?:\s+v\S+)?\s*=>\s*(\S+)/.exec(content);
      const [, from = "", to = ""] = replace ?? [];
      if (replace === null || from.startsWith("//") || /^[./]/.test(to) || to === from) {
        return [];
      }
      return [{ kind: "replaced", module: /^[\w.~+/-]{1,200}$/.test(to) ? to : "another module" }];
    }
  },
  { files: /(?:^|\/)Cargo\.lock$/i, urls: firstUrl(/^\s*source\s*=\s*"((?:registry\+|sparse\+|git\+)?[a-z][\w+.-]*:\/\/[^"]+)"/i) },
  { files: /(?:^|\/)Gemfile\.lock$/i, urls: firstUrl(/^\s*remote:\s*([a-z][\w+.-]*:\/\/\S+)/i) },
  { files: /(?:^|\/)\.npmrc$/i, urls: firstUrl(/^\s*(?:@[\w.-]+:)?registry\s*=\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  { files: /(?:^|\/)\.yarnrc\.yml$/i, urls: firstUrl(/^\s*npmRegistryServer:\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  {
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$|(?:^|\/)pip\.conf$/i,
    urls: (content) => {
      if (/^\s*(?:--)?trusted-host\b/i.test(content)) {
        return [{ kind: "unverified" }];
      }
      const index = /^\s*(-i|--index-url|index-url|--extra-index-url|extra-index-url|-f|--find-links)(?:\s*=\s*|\s+)(\S+)/i.exec(content);
      if (index) {
        return [{ url: index[2] ?? "", extraIndex: /extra/i.test(index[1] ?? "") }];
      }
      const direct = /^[^#]*?(?:@\s*|^\s*(?:-e\s+)?)((?:git\+)?[a-z][\w+.-]*:\/\/\S+)/i.exec(content);
      return direct ? [{ url: direct[1] ?? "" }] : [];
    }
  }
];
function isSourceFile(path2) {
  return !isTestDataPath(path2) && readers.some((reader) => reader.files.test(path2));
}
function findLockfileSources(path2, patch, allowedSources) {
  const reader = readers.find((candidate) => candidate.files.test(path2));
  if (reader === void 0 || isTestDataPath(path2)) {
    return [];
  }
  const allowed = [...defaultAllowedSources, ...allowedSources].flatMap((source) => parseUrl(source) ?? []);
  let section = "";
  const found = [];
  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    if (startsHunk) {
      section = sectionName(hunkContext ?? "") ?? "";
    }
    section = sectionName(content) ?? section;
    if (!added) {
      continue;
    }
    for (const entry of reader.urls(content, section)) {
      const source = "kind" in entry ? entry : entry.extraIndex ? { kind: "extra-index" } : classify(entry.url, allowed, section === "GIT" || entry.git === true);
      if (source !== void 0) {
        found.push({ line, ...source });
      }
    }
  }
  return found;
}
function sectionName(content) {
  return /^([A-Z]+)$|^\s*\[\[?\s*([^\]\s]+)\s*\]\]?\s*(?:#.*)?$/.exec(content.trimEnd())?.slice(1).find(Boolean);
}
function classify(raw, allowed, gitSection) {
  if (gitSection || /^git\+|^git:|^ssh:/i.test(raw)) {
    return { kind: "git" };
  }
  const url = parseUrl(raw.replace(/^(?:registry|sparse)\+/i, ""));
  if (url === void 0 || url.protocol === "file:") {
    return void 0;
  }
  if (allowed.some((source) => isUnder(url, source))) {
    return void 0;
  }
  if (url.protocol === "http:") {
    return { kind: "insecure" };
  }
  if (gitHosts.test(url.hostname)) {
    return { kind: "git" };
  }
  return { kind: "unlisted", host: url.hostname };
}
function isUnder(url, source) {
  if (url.protocol !== source.protocol || url.host !== source.host) {
    return false;
  }
  const base = source.pathname.endsWith("/") ? source.pathname : `${source.pathname}/`;
  return url.pathname === source.pathname || url.pathname.startsWith(base);
}
function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return void 0;
  }
}

// src/rules/lockfile-source.ts
var lockfileSourceRule = {
  id: "lockfile-source",
  description: "Flags lockfile entries and registry settings that fetch packages from outside the allowed registries.",
  seesIgnoredFiles: true,
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.lockfileSources;
    if (!ruleConfig.enabled) {
      return [];
    }
    return files.flatMap((file) => {
      const sources2 = sourcesIn(file, ruleConfig.allowedSources);
      if (sources2.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(sources2.map((source) => source.line));
      const hosts = [...new Set(sources2.flatMap((source) => source.host ?? []))];
      const modules = [...new Set(sources2.flatMap((source) => source.module ?? []))];
      const parts = [
        hosts.length > 0 ? `downloaded from ${hosts.length > 1 ? "hosts that are not allowed registries" : "a host that is not an allowed registry"} (${hosts.slice(0, 3).join(", ")}${hosts.length > 3 ? ", ..." : ""})` : "",
        sources2.some((source) => source.kind === "insecure") ? "downloaded over plain HTTP" : "",
        sources2.some((source) => source.kind === "unverified") ? "downloaded without TLS verification" : "",
        sources2.some((source) => source.kind === "git") ? "installed from a Git repository" : "",
        modules.length > 0 ? `replaced with ${modules.length > 1 ? "different modules" : "a different module"} (${modules.slice(0, 3).join(", ")}${modules.length > 3 ? ", ..." : ""})` : "",
        sources2.some((source) => source.kind === "extra-index") ? "fetched from an extra package index" : ""
      ].filter(Boolean);
      const high = sources2.some((source) => ["unlisted", "insecure", "unverified"].includes(source.kind));
      return [
        {
          ruleId: "lockfile-source",
          title: high ? "Dependency from an untrusted source" : "Dependency from outside a registry",
          severity: high ? "high" : "warning",
          file: file.path,
          line: Math.min(...sources2.map((source) => source.line)),
          message: `${text} ${plural ? "add dependencies" : "adds a dependency"} ${joinParts(parts)}.`,
          recommendation: "Check that each URL is the package you expect. A lockfile can point a familiar package name at any tarball, and installs run its scripts. Add private registries to rules.lockfileSources.allowedSources, pin Git dependencies to a commit, prefer --index-url over --extra-index-url, and keep TLS verification on."
        }
      ];
    });
  }
};
function sourcesIn(file, allowedSources) {
  if (file.lockfileSources !== void 0) {
    return file.lockfileSources;
  }
  return file.patch === void 0 || !isSourceFile(file.path) ? [] : findLockfileSources(file.path, file.patch, allowedSources);
}
function joinParts(parts) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}` : parts[0] ?? "";
}

// src/analysis/manifest-dependencies.ts
var packageName = "[A-Za-z0-9][A-Za-z0-9._-]{0,213}";
var npmDependencySections = /* @__PURE__ */ new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions"
]);
var npmFields = /* @__PURE__ */ new Set(["version", "node", "npm", "tag", "registry"]);
var npmMetadataFields = /* @__PURE__ */ new Set(["url", "homepage", "repository", "bugs", "funding"]);
var npmOpen = /^\s*(?:"([^"]{1,214})"\s*:\s*)?[{[]\s*$/;
var npmClose = /^\s*[}\]]\s*,?\s*$/;
var npmVersion = /^(?:[\^~<>=]{0,2}\s?v?\d|\*$|x$|latest$|next$|npm:|workspace:|file:|link:|git[+:]|github:|https?:)/i;
var npmEntry = new RegExp(`^\\s*"((?:@${packageName}\\/)?${packageName})"\\s*:\\s*"([^"]{0,200})"`);
var requirementLine = new RegExp(`^\\s*(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*([<>=!~][^;#]{0,100}|@[^;#]{0,200})?(?:[;#]|$)`);
var quotedRequirement = new RegExp(
  `"(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*((?:[<>=!~]=|[<>]|===)[^";]{0,100})`,
  "g"
);
var tomlEntry = new RegExp(`^\\s*"?(${packageName})"?\\s*=\\s*(.{0,300})$`);
var gemLine = new RegExp(
  `^\\s*(?:gem|\\w{1,50}\\.add_(?:runtime_|development_)?dependency)\\s*\\(?\\s*["'](${packageName})["'](?:\\s*,\\s*["']([^"']{1,100})["'])?`
);
var tableHeader = /^\s*\[\[?([^\]]{1,200})\]\]?\s*(?:#.*)?$/;
var hunkHeader3 = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.{0,300})/;
var goModule = "[A-Za-z0-9][A-Za-z0-9._~/-]{0,250}";
var goRequireLine = new RegExp(`^\\s*require\\s+(${goModule})\\s+(v\\S{1,100})`);
var goBlockEntry = new RegExp(`^\\s*(${goModule})\\s+(v\\S{1,100})`);
var composerEntry = /^\s*"([a-z0-9][a-z0-9_.-]{0,100}\/[a-z0-9][a-z0-9_.-]{0,100})"\s*:\s*"([^"]{0,200})"/;
var composerVersion = /^(?:[\^~<>=!]{0,2}\s?v?\d|\*$|dev-|@)/i;
var nugetTag = /<\s*(?:PackageReference|PackageVersion|GlobalPackageReference)\b([^>]{0,500})/i;
var nugetName = /\b(?:Include|Update)\s*=\s*"([A-Za-z0-9_.-]{1,200})"/i;
var nugetVersion = /\bVersion(?:Override)?\s*=\s*"([^"]{0,100})"/i;
var packagesConfigTag = /<\s*package\b([^>]{0,500})/i;
var gradleConfiguration = "(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|androidTestImplementation|debugImplementation|releaseImplementation|annotationProcessor|kapt|ksp|classpath|compile|testCompile|runtime)";
var gradleCoordinate = new RegExp(
  `^\\s*${gradleConfiguration}\\s*\\(?\\s*(?:(?:platform|enforcedPlatform)\\s*\\(\\s*)?["']([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})(?::([^"'@\\s]{1,100}))?(?:@\\w{1,20})?["']`
);
var gradleMap = new RegExp(
  `^\\s*${gradleConfiguration}\\s*\\(?\\s*group\\s*[:=]\\s*["']([A-Za-z0-9_.-]{1,200})["']\\s*,\\s*name\\s*[:=]\\s*["']([A-Za-z0-9_.-]{1,200})["'](?:\\s*,\\s*version\\s*[:=]\\s*["']([^"']{1,100})["'])?`
);
var catalogEntry = /^\s*[A-Za-z0-9_.-]{1,100}\s*=\s*(.{1,400})$/;
var goBlockStart = /^\s*(require|replace|exclude|retract)\s*\(\s*(?:\/\/.*)?$/;
var manifests = [
  {
    ecosystem: "npm",
    files: /(?:^|\/)package\.json$/,
    // `"name": "version"` in a dependencies object. The section holds the keys of the objects and
    // arrays a line is in, one per line, with "" for those without a key, as far as the hunk shows.
    entries(content, section) {
      const [matched, name = "", version3 = ""] = npmEntry.exec(content) ?? [];
      if (matched === void 0 || npmFields.has(name) || !npmVersion.test(version3)) {
        return [];
      }
      const enclosing = section.split("\n").filter(Boolean).at(-1);
      if (enclosing === void 0) {
        return npmMetadataFields.has(name) ? [] : [{ name, version: version3 }];
      }
      return npmDependencySections.has(enclosing) ? [{ name, version: version3 }] : [];
    },
    section(content, current) {
      const opened = npmOpen.exec(content);
      if (opened) {
        return current === "" ? `
${opened[1] ?? ""}` : `${current}
${opened[1] ?? ""}`;
      }
      return npmClose.test(content) ? current.slice(0, Math.max(0, current.lastIndexOf("\n"))) : void 0;
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$/i,
    // `name`, `name[extra]`, `name>=1.0`, or `name @ url`; options and URLs are not package names.
    entries(content) {
      const [matched, name = "", version3 = ""] = requirementLine.exec(content) ?? [];
      return matched === void 0 ? [] : [{ name, version: version3.trim() }];
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)pyproject\.toml$/i,
    entries(content, section) {
      const requirements = [...content.matchAll(quotedRequirement)].map((match2) => ({
        name: match2[1] ?? "",
        version: (match2[2] ?? "").trim()
      }));
      if (/^tool\.poetry\.(?:dependencies|dev-dependencies|group\.[^.]+\.dependencies)$/.test(section)) {
        return [...requirements, ...tomlEntries(content).filter((entry) => entry.name !== "python")];
      }
      return requirements;
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)Pipfile$/,
    entries: (content, section) => /^(?:packages|dev-packages)$/.test(section) ? tomlEntries(content) : []
  },
  {
    ecosystem: "RubyGems",
    files: /(?:^|\/)(?:Gemfile|[^/]+\.gemspec)$/,
    entries(content) {
      const [matched, name = "", version3 = ""] = gemLine.exec(content) ?? [];
      return matched === void 0 ? [] : [{ name, version: version3 }];
    }
  },
  {
    ecosystem: "Packagist",
    files: /(?:^|\/)composer\.json$/,
    // `"vendor/name": "^1.0"`; platform requirements such as `php` and `ext-json` have no vendor.
    entries(content) {
      const [matched, name = "", version3 = ""] = composerEntry.exec(content) ?? [];
      return matched !== void 0 && composerVersion.test(version3) ? [{ name, version: version3 }] : [];
    }
  },
  {
    ecosystem: "NuGet",
    files: /(?:^|\/)(?:[^/]+\.(?:cs|fs|vb)proj|Directory\.(?:Packages|Build)\.props)$/i,
    // `<PackageReference Include="Name" Version="1.0" />`, on one line; a version given as a child
    // element is read as none.
    entries(content) {
      const attributes = nugetTag.exec(content)?.[1];
      const name = attributes === void 0 ? void 0 : nugetName.exec(attributes)?.[1];
      return name === void 0 ? [] : [{ name, version: nugetVersion.exec(attributes ?? "")?.[1] ?? "" }];
    }
  },
  {
    ecosystem: "NuGet",
    files: /(?:^|\/)packages\.config$/i,
    entries(content) {
      const attributes = packagesConfigTag.exec(content)?.[1] ?? "";
      const name = /\bid\s*=\s*"([A-Za-z0-9_.-]{1,200})"/i.exec(attributes)?.[1];
      return name === void 0 ? [] : [{ name, version: /\bversion\s*=\s*"([^"]{0,100})"/i.exec(attributes)?.[1] ?? "" }];
    }
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)pom\.xml$/,
    entries: () => [],
    parse: mavenDependencies
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)build\.gradle(?:\.kts)?$/,
    // `implementation("group:artifact:1.0")`, `implementation 'group:artifact:1.0'`, `platform(...)`,
    // and `implementation group: 'g', name: 'a', version: '1.0'`.
    entries(content) {
      const [matched, group = "", artifact = "", version3 = ""] = gradleCoordinate.exec(content) ?? gradleMap.exec(content) ?? [];
      return matched === void 0 ? [] : [{ name: `${group}:${artifact}`, version: version3 }];
    }
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)libs\.versions\.toml$/,
    // `[libraries]` entries: `"group:artifact:1.0"`, or a table with `module` or `group` and `name`,
    // and a `version`; a `version.ref` names a `[versions]` entry and reads as no version.
    entries(content, section) {
      const value = section === "libraries" ? catalogEntry.exec(content)?.[1] : void 0;
      if (value === void 0) {
        return [];
      }
      const short = /^"([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})(?::([^"]{1,100}))?"/.exec(value);
      const module2 = /\bmodule\s*=\s*"([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})"/.exec(value);
      const group = /\bgroup\s*=\s*"([A-Za-z0-9_.-]{1,200})"/.exec(value)?.[1];
      const name = /\bname\s*=\s*"([A-Za-z0-9_.-]{1,200})"/.exec(value)?.[1];
      const version3 = /\bversion\s*=\s*"([^"]{1,100})"/.exec(value)?.[1] ?? "";
      if (short) {
        return [{ name: `${short[1]}:${short[2]}`, version: short[3] ?? "" }];
      }
      if (module2) {
        return [{ name: `${module2[1]}:${module2[2]}`, version: version3 }];
      }
      return group !== void 0 && name !== void 0 ? [{ name: `${group}:${name}`, version: version3 }] : [];
    }
  },
  {
    ecosystem: "Go",
    files: /(?:^|\/)go\.mod$/,
    // `require path v1.2.3`, or `path v1.2.3` inside a `require (` block; `replace` and `exclude`
    // blocks name modules too, but not dependencies.
    entries(content, section) {
      const [matched, name = "", version3 = ""] = goRequireLine.exec(content) ?? (section === "require" ? goBlockEntry.exec(content) : null) ?? [];
      return matched === void 0 ? [] : [{ name, version: version3 }];
    },
    section: (content) => goBlockStart.exec(content)?.[1] ?? (/^\s*\)\s*$/.test(content) ? "" : void 0)
  },
  {
    ecosystem: "crates.io",
    files: /(?:^|\/)Cargo\.toml$/,
    // `[dependencies]`, `[dev-dependencies]`, `[workspace.dependencies]`, `[target.'cfg(..)'.dependencies]`.
    entries: (content, section) => /(?:^|\.)(?:dev-|build-)?dependencies$/.test(section) ? tomlEntries(content) : []
  }
];
function manifestEcosystem(path2) {
  return manifestFor(path2)?.ecosystem;
}
function manifestFor(path2) {
  return isTestDataPath(path2) ? void 0 : manifests.find((manifest) => manifest.files.test(path2));
}
function declaredDependencies(path2, patch) {
  const manifest = manifestFor(path2);
  const added = [];
  const removed = [];
  if (manifest === void 0) {
    return { added, removed };
  }
  if (manifest.parse !== void 0) {
    return manifest.parse(patch);
  }
  let oldLine;
  let newLine = 0;
  const sectionOf = manifest.section ?? ((content) => tableHeader.exec(content)?.[1]?.trim());
  let oldSection = "";
  let newSection = "";
  for (const line of patch.split(/\r?\n/)) {
    const header2 = hunkHeader3.exec(line);
    if (header2) {
      oldLine = Number(header2[1]);
      newLine = Number(header2[2]);
      oldSection = newSection = sectionOf(header2[3] ?? "", "") ?? "";
      continue;
    }
    if (oldLine === void 0 || line.startsWith("\\")) {
      continue;
    }
    const content = line.slice(1);
    if (line.startsWith("+")) {
      newSection = sectionOf(content, newSection) ?? newSection;
      added.push(...manifest.entries(content, newSection).map((entry) => ({ ...entry, line: newLine })));
      newLine += 1;
    } else if (line.startsWith("-")) {
      oldSection = sectionOf(content, oldSection) ?? oldSection;
      removed.push(...manifest.entries(content, oldSection).map((entry) => ({ ...entry, line: oldLine ?? 0 })));
      oldLine += 1;
    } else {
      newSection = sectionOf(content, newSection) ?? newSection;
      oldSection = sectionOf(content, oldSection) ?? oldSection;
      newLine += 1;
      oldLine += 1;
    }
  }
  return { added, removed };
}
function dependencyChanges(files) {
  return files.flatMap((file) => {
    const ecosystem = manifestEcosystem(file.path);
    if (ecosystem === void 0 || file.patch === void 0) {
      return [];
    }
    const { added, removed } = declaredDependencies(file.path, file.patch);
    const before2 = byName(removed, ecosystem);
    const after2 = byName(added, ecosystem);
    const changes = [];
    for (const [key, dependency] of after2) {
      const previous = before2.get(key);
      if (previous === void 0) {
        changes.push({ file: file.path, ecosystem, name: dependency.name, to: dependency.version, line: dependency.line });
      } else if (previous.version !== dependency.version) {
        changes.push({
          file: file.path,
          ecosystem,
          name: dependency.name,
          from: previous.version,
          to: dependency.version,
          line: dependency.line
        });
      }
    }
    for (const [key, dependency] of before2) {
      if (!after2.has(key)) {
        changes.push({ file: file.path, ecosystem, name: dependency.name, from: dependency.version });
      }
    }
    return changes;
  });
}
function byName(dependencies, ecosystem) {
  const map = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    const key = normalizePackageName(dependency.name, ecosystem);
    if (!map.has(key)) {
      map.set(key, dependency);
    }
  }
  return map;
}
function normalizePackageName(name, ecosystem) {
  const lower = name.toLowerCase();
  if (ecosystem === "PyPI") {
    return lower.replace(/[-_.]+/g, "-");
  }
  return ecosystem === "Go" ? lower.replace(/\/v\d+$/, "").replace(/^(gopkg\.in\/.+)\.v\d+$/, "$1") : lower;
}
function tomlEntries(content) {
  const [matched, name = "", value = ""] = tomlEntry.exec(content) ?? [];
  if (matched === void 0) {
    return [];
  }
  const version3 = /^"([^"]{0,100})"/.exec(value.trim())?.[1] ?? /\bversion\s*=\s*"([^"]{0,100})"/.exec(value)?.[1] ?? "";
  return [{ name, version: version3 }];
}
function mavenDependencies(patch) {
  const added = [];
  const removed = [];
  for (const hunk of hunksOf(patch)) {
    added.push(...dependencyBlocks(hunk, "+"));
    removed.push(...dependencyBlocks(hunk, "-"));
  }
  return { added, removed };
}
function hunksOf(patch) {
  const hunks = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of patch.split(/\r?\n/)) {
    const header2 = hunkHeader3.exec(line);
    if (header2) {
      oldLine = Number(header2[1]);
      newLine = Number(header2[2]);
      hunks.push([]);
      continue;
    }
    const hunk = hunks[hunks.length - 1];
    const kind = line[0];
    if (hunk === void 0 || kind !== " " && kind !== "+" && kind !== "-") {
      continue;
    }
    hunk.push({ kind, content: line.slice(1), oldLine, newLine });
    if (kind !== "+") {
      oldLine += 1;
    }
    if (kind !== "-") {
      newLine += 1;
    }
  }
  return hunks;
}
function dependencyBlocks(lines, side) {
  const found = [];
  let block = [];
  for (const line of lines) {
    const shown2 = line.kind === " " || line.kind === side;
    if (shown2 && /<dependency\b[^>]{0,100}>/.test(line.content)) {
      block = [];
    }
    block.push(line);
    if (!shown2 || !/<\/dependency\s*>/.test(line.content)) {
      continue;
    }
    const text = block.filter((entry) => entry.kind === " " || entry.kind === side).map((entry) => entry.content).join(" ");
    const group = /<groupId>\s*([^<\s]{1,200})\s*<\/groupId>/.exec(text)?.[1];
    const artifact = /<artifactId>\s*([^<\s]{1,200})\s*<\/artifactId>/.exec(text)?.[1];
    const changed = block.find((entry) => entry.kind !== " ");
    if (group !== void 0 && artifact !== void 0 && changed !== void 0) {
      const version3 = /<version>\s*([^<\s]{1,100})\s*<\/version>/.exec(text)?.[1] ?? "";
      found.push({ name: `${group}:${artifact}`, version: version3, line: side === "+" ? changed.newLine : changed.oldLine });
    }
    block = [];
  }
  return found;
}

// src/security/popular-packages.ts
var popularPackages = {
  npm: [
    "react",
    "react-dom",
    "react-router",
    "react-router-dom",
    "react-redux",
    "redux",
    "redux-thunk",
    "vue",
    "vue-router",
    "vuex",
    "pinia",
    "svelte",
    "next",
    "nuxt",
    "preact",
    "jquery",
    "lodash",
    "underscore",
    "ramda",
    "axios",
    "request",
    "node-fetch",
    "superagent",
    "express",
    "koa",
    "fastify",
    "body-parser",
    "cors",
    "helmet",
    "morgan",
    "cookie-parser",
    "express-session",
    "passport",
    "jsonwebtoken",
    "bcrypt",
    "bcryptjs",
    "dotenv",
    "uuid",
    "nanoid",
    "moment",
    "dayjs",
    "date-fns",
    "luxon",
    "chalk",
    "commander",
    "yargs",
    "inquirer",
    "debug",
    "semver",
    "glob",
    "minimatch",
    "rimraf",
    "mkdirp",
    "fs-extra",
    "chokidar",
    "async",
    "bluebird",
    "rxjs",
    "socket.io",
    "socket.io-client",
    "mongoose",
    "mongodb",
    "mysql",
    "mysql2",
    "sequelize",
    "typeorm",
    "prisma",
    "knex",
    "redis",
    "ioredis",
    "graphql",
    "typescript",
    "ts-node",
    "tslib",
    "webpack",
    "webpack-cli",
    "webpack-dev-server",
    "babel-loader",
    "vite",
    "rollup",
    "esbuild",
    "parcel",
    "eslint",
    "prettier",
    "jest",
    "mocha",
    "chai",
    "sinon",
    "jasmine",
    "karma",
    "cypress",
    "puppeteer",
    "playwright",
    "supertest",
    "nodemon",
    "concurrently",
    "cross-env",
    "husky",
    "lint-staged",
    "classnames",
    "prop-types",
    "styled-components",
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "sass",
    "less",
    "bootstrap",
    "three",
    "chart.js",
    "marked",
    "highlight.js",
    "cheerio",
    "jsdom",
    "xml2js",
    "yaml",
    "js-yaml",
    "ajv",
    "joi",
    "yup",
    "zod",
    "validator",
    "colors",
    "winston",
    "pino",
    "handlebars",
    "mustache",
    "nodemailer",
    "multer",
    "sharp",
    "jimp",
    "canvas",
    "aws-sdk",
    "firebase",
    "stripe",
    "twilio",
    "electron",
    "core-js",
    "regenerator-runtime",
    "immer",
    "immutable",
    "mobx",
    "zustand",
    "formik",
    "crypto-js",
    "node-forge",
    "ethers",
    "web3",
    "archiver",
    "adm-zip",
    "form-data",
    "mime",
    "mime-types",
    "iconv-lite",
    "string-width",
    "strip-ansi",
    "ansi-regex",
    "kleur",
    "picocolors",
    "execa",
    "cross-spawn",
    "shelljs",
    "compression",
    "serve-static",
    "http-proxy",
    "cookie",
    "cookies",
    "mquery",
    "lru-cache",
    "uglify-js",
    "terser",
    "cssnano",
    "css-loader",
    "style-loader",
    "file-loader",
    "ts-loader",
    "html-webpack-plugin",
    "lerna",
    "gulp",
    "grunt",
    "browserify",
    "vitest",
    "nock",
    "msw",
    "underscore.string",
    "qrcode",
    "pdfkit",
    "puppeteer-core",
    "discord.js",
    "openai",
    "cuid"
  ],
  PyPI: [
    "requests",
    "urllib3",
    "certifi",
    "idna",
    "charset-normalizer",
    "chardet",
    "numpy",
    "pandas",
    "scipy",
    "matplotlib",
    "seaborn",
    "scikit-learn",
    "tensorflow",
    "torch",
    "torchvision",
    "keras",
    "django",
    "djangorestframework",
    "flask",
    "fastapi",
    "starlette",
    "uvicorn",
    "gunicorn",
    "celery",
    "redis",
    "sqlalchemy",
    "psycopg2",
    "psycopg2-binary",
    "pymysql",
    "pymongo",
    "mysqlclient",
    "boto3",
    "botocore",
    "s3transfer",
    "awscli",
    "setuptools",
    "wheel",
    "pip",
    "six",
    "python-dateutil",
    "pytz",
    "pyyaml",
    "jinja2",
    "markupsafe",
    "click",
    "attrs",
    "packaging",
    "pyparsing",
    "cryptography",
    "pyopenssl",
    "cffi",
    "pycparser",
    "jmespath",
    "rsa",
    "pyasn1",
    "protobuf",
    "grpcio",
    "typing-extensions",
    "pydantic",
    "aiohttp",
    "httpx",
    "beautifulsoup4",
    "lxml",
    "pillow",
    "opencv-python",
    "selenium",
    "pytest",
    "pytest-cov",
    "pytest-mock",
    "mock",
    "coverage",
    "tox",
    "black",
    "flake8",
    "pylint",
    "mypy",
    "isort",
    "ruff",
    "colorama",
    "tqdm",
    "rich",
    "docutils",
    "sphinx",
    "jsonschema",
    "simplejson",
    "ujson",
    "orjson",
    "werkzeug",
    "itsdangerous",
    "paramiko",
    "fabric",
    "ansible",
    "docker",
    "kubernetes",
    "openai",
    "transformers",
    "nltk",
    "spacy",
    "scrapy",
    "twisted",
    "tornado",
    "gevent",
    "greenlet",
    "websocket-client",
    "websockets",
    "pyjwt",
    "oauthlib",
    "requests-oauthlib",
    "python-dotenv",
    "tabulate",
    "toml",
    "tomli",
    "filelock",
    "virtualenv",
    "platformdirs",
    "wrapt",
    "decorator",
    "more-itertools",
    "networkx",
    "sympy",
    "openpyxl",
    "xlsxwriter",
    "pyarrow",
    "dask",
    "numba",
    "plotly",
    "streamlit",
    "langchain",
    "marshmallow",
    "alembic",
    "peewee",
    "arrow",
    "pendulum",
    "pyzmq",
    "ipython",
    "jupyter",
    "notebook",
    "psutil",
    "pywin32",
    "pycryptodome",
    "bcrypt",
    "passlib",
    "argon2-cffi",
    "pyserial",
    "pygments",
    "termcolor",
    "loguru",
    "httplib2",
    "google-auth",
    "google-api-python-client",
    "azure-core",
    "pymssql",
    "elasticsearch",
    "scapy",
    "attr"
  ],
  RubyGems: [
    "rails",
    "rake",
    "rack",
    "bundler",
    "nokogiri",
    "json",
    "activesupport",
    "activerecord",
    "actionpack",
    "railties",
    "puma",
    "unicorn",
    "sinatra",
    "devise",
    "rspec",
    "rspec-rails",
    "minitest",
    "rubocop",
    "capybara",
    "sidekiq",
    "redis",
    "mysql2",
    "sqlite3",
    "faraday",
    "httparty",
    "rest-client",
    "jwt",
    "bcrypt",
    "byebug",
    "thor",
    "sass",
    "sprockets",
    "webpacker",
    "kaminari",
    "pundit",
    "cancancan",
    "omniauth",
    "carrierwave",
    "shrine",
    "factory_bot",
    "faker",
    "simplecov",
    "dotenv",
    "figaro",
    "multi_json",
    "i18n",
    "tzinfo",
    "concurrent-ruby",
    "mime-types",
    "rack-test",
    "rack-cors",
    "grape",
    "hanami",
    "sequel",
    "mongoid",
    "resque",
    "whenever",
    "capistrano",
    "foreman",
    "sentry-ruby",
    "newrelic_rpm",
    "haml",
    "slim",
    "erubi",
    "builder",
    "mail",
    "letter_opener",
    "aws-sdk",
    "stripe",
    "graphql",
    "dry-validation",
    "sorbet",
    "bootsnap",
    "listen",
    "spring",
    "turbolinks",
    "jbuilder"
  ],
  "crates.io": [
    "serde",
    "serde_json",
    "serde_derive",
    "serde_yaml",
    "tokio",
    "futures",
    "async-trait",
    "rand",
    "regex",
    "clap",
    "anyhow",
    "thiserror",
    "log",
    "env_logger",
    "tracing",
    "tracing-subscriber",
    "chrono",
    "time",
    "uuid",
    "lazy_static",
    "once_cell",
    "reqwest",
    "hyper",
    "axum",
    "actix-web",
    "warp",
    "rocket",
    "tonic",
    "prost",
    "bytes",
    "itertools",
    "rayon",
    "crossbeam",
    "parking_lot",
    "libc",
    "winapi",
    "windows",
    "syn",
    "quote",
    "proc-macro2",
    "bitflags",
    "byteorder",
    "base64",
    "sha2",
    "ring",
    "rustls",
    "openssl",
    "url",
    "http",
    "mime",
    "toml",
    "bincode",
    "csv",
    "diesel",
    "sqlx",
    "rusqlite",
    "redis",
    "structopt",
    "indicatif",
    "colored",
    "termcolor",
    "dirs",
    "tempfile",
    "walkdir",
    "glob",
    "num-traits",
    "smallvec",
    "arrayvec",
    "hashbrown",
    "indexmap",
    "criterion",
    "proptest",
    "mockall",
    "wasm-bindgen",
    "js-sys",
    "web-sys",
    "image",
    "nalgebra",
    "ndarray",
    "semver",
    "flate2",
    "zip",
    "dashmap",
    "memchr",
    "aho-corasick",
    "nom",
    "pest"
  ],
  // Without their major version suffix, as they are compared.
  Go: [
    "github.com/gin-gonic/gin",
    "github.com/gorilla/mux",
    "github.com/gorilla/websocket",
    "github.com/stretchr/testify",
    "github.com/stretchr/objx",
    "github.com/sirupsen/logrus",
    "go.uber.org/zap",
    "go.uber.org/fx",
    "github.com/spf13/cobra",
    "github.com/spf13/viper",
    "github.com/spf13/pflag",
    "github.com/pkg/errors",
    "github.com/google/uuid",
    "github.com/google/go-cmp",
    "github.com/golang/protobuf",
    "google.golang.org/grpc",
    "google.golang.org/protobuf",
    "golang.org/x/net",
    "golang.org/x/crypto",
    "golang.org/x/sync",
    "golang.org/x/sys",
    "golang.org/x/text",
    "golang.org/x/oauth2",
    "golang.org/x/exp",
    "golang.org/x/mod",
    "golang.org/x/term",
    "golang.org/x/time",
    "golang.org/x/tools",
    "golang.org/x/image",
    "github.com/go-redis/redis",
    "github.com/redis/go-redis",
    "github.com/lib/pq",
    "github.com/jackc/pgx",
    "github.com/go-sql-driver/mysql",
    "github.com/mattn/go-sqlite3",
    "gorm.io/gorm",
    "gorm.io/driver/postgres",
    "github.com/labstack/echo",
    "github.com/gofiber/fiber",
    "github.com/go-chi/chi",
    "github.com/valyala/fasthttp",
    "github.com/prometheus/client_golang",
    "github.com/aws/aws-sdk-go",
    "github.com/aws/aws-sdk-go-v2",
    "k8s.io/client-go",
    "k8s.io/apimachinery",
    "k8s.io/api",
    "github.com/golang-jwt/jwt",
    "github.com/dgrijalva/jwt-go",
    "github.com/joho/godotenv",
    "github.com/rs/zerolog",
    "github.com/urfave/cli",
    "github.com/docker/docker",
    "gopkg.in/yaml.v2",
    "gopkg.in/yaml.v3",
    "github.com/burntsushi/toml",
    "github.com/davecgh/go-spew",
    "github.com/onsi/ginkgo",
    "github.com/onsi/gomega",
    "go.mongodb.org/mongo-driver",
    "github.com/json-iterator/go",
    "github.com/tidwall/gjson",
    "github.com/mitchellh/mapstructure",
    "github.com/hashicorp/go-multierror",
    "github.com/cenkalti/backoff",
    "github.com/fsnotify/fsnotify",
    "go.opentelemetry.io/otel",
    "github.com/golang/mock",
    "go.uber.org/mock",
    "github.com/google/go-github"
  ],
  Packagist: [
    "laravel/framework",
    "laravel/sanctum",
    "laravel/tinker",
    "laravel/sail",
    "laravel/pint",
    "symfony/console",
    "symfony/http-foundation",
    "symfony/http-kernel",
    "symfony/routing",
    "symfony/yaml",
    "symfony/process",
    "symfony/finder",
    "symfony/var-dumper",
    "symfony/event-dispatcher",
    "symfony/mailer",
    "symfony/translation",
    "symfony/framework-bundle",
    "guzzlehttp/guzzle",
    "guzzlehttp/psr7",
    "monolog/monolog",
    "phpunit/phpunit",
    "doctrine/orm",
    "doctrine/dbal",
    "nesbot/carbon",
    "vlucas/phpdotenv",
    "league/flysystem",
    "ramsey/uuid",
    "fakerphp/faker",
    "mockery/mockery",
    "phpstan/phpstan",
    "squizlabs/php_codesniffer",
    "friendsofphp/php-cs-fixer",
    "twig/twig",
    "psr/log",
    "psr/http-message",
    "psr/container",
    "spatie/laravel-permission",
    "predis/predis",
    "firebase/php-jwt",
    "phpmailer/phpmailer",
    "aws/aws-sdk-php",
    "intervention/image",
    "barryvdh/laravel-debugbar",
    "nunomaduro/collision",
    "filp/whoops",
    "egulias/email-validator",
    "illuminate/support",
    "slim/slim",
    "cakephp/cakephp",
    "yiisoft/yii2",
    "composer/composer",
    "league/oauth2-server",
    "stripe/stripe-php",
    "google/apiclient",
    "sentry/sentry-laravel",
    "pestphp/pest"
  ],
  NuGet: [
    "Newtonsoft.Json",
    "Serilog",
    "Serilog.AspNetCore",
    "Serilog.Sinks.Console",
    "Serilog.Sinks.File",
    "AutoMapper",
    "Dapper",
    "FluentValidation",
    "MediatR",
    "Polly",
    "xunit",
    "xunit.runner.visualstudio",
    "NUnit",
    "NUnit3TestAdapter",
    "Moq",
    "FluentAssertions",
    "Microsoft.NET.Test.Sdk",
    "coverlet.collector",
    "Swashbuckle.AspNetCore",
    "Microsoft.EntityFrameworkCore",
    "Microsoft.EntityFrameworkCore.SqlServer",
    "Microsoft.EntityFrameworkCore.Design",
    "Microsoft.EntityFrameworkCore.Tools",
    "Npgsql",
    "Npgsql.EntityFrameworkCore.PostgreSQL",
    "Pomelo.EntityFrameworkCore.MySql",
    "StackExchange.Redis",
    "RestSharp",
    "Microsoft.Extensions.DependencyInjection",
    "Microsoft.Extensions.Logging",
    "Microsoft.Extensions.Configuration",
    "Microsoft.Extensions.Hosting",
    "Microsoft.Extensions.Http",
    "Microsoft.AspNetCore.Authentication.JwtBearer",
    "System.IdentityModel.Tokens.Jwt",
    "Azure.Identity",
    "Azure.Storage.Blobs",
    "AWSSDK.Core",
    "AWSSDK.S3",
    "AWSSDK.SQS",
    "AWSSDK.SNS",
    "Hangfire",
    "Quartz",
    "NLog",
    "log4net",
    "CsvHelper",
    "Humanizer",
    "Bogus",
    "NSubstitute",
    "Castle.Core",
    "BenchmarkDotNet",
    "MassTransit",
    "RabbitMQ.Client",
    "Grpc.Net.Client",
    "Google.Protobuf",
    "System.Text.Json",
    "Microsoft.Data.SqlClient",
    "MongoDB.Driver",
    "NEST",
    "Refit",
    "Scrutor",
    "Mapster",
    "OpenTelemetry"
  ],
  // `group:artifact`, as Maven and Gradle name them.
  Maven: [
    "org.springframework:spring-core",
    "org.springframework:spring-context",
    "org.springframework:spring-web",
    "org.springframework:spring-webmvc",
    "org.springframework.boot:spring-boot-starter",
    "org.springframework.boot:spring-boot-starter-web",
    "org.springframework.boot:spring-boot-starter-test",
    "org.springframework.boot:spring-boot-starter-data-jpa",
    "org.springframework.boot:spring-boot-starter-security",
    "com.fasterxml.jackson.core:jackson-databind",
    "com.fasterxml.jackson.core:jackson-core",
    "com.fasterxml.jackson.core:jackson-annotations",
    "com.google.guava:guava",
    "org.apache.commons:commons-lang3",
    "org.apache.commons:commons-collections4",
    "commons-io:commons-io",
    "commons-codec:commons-codec",
    "org.slf4j:slf4j-api",
    "ch.qos.logback:logback-classic",
    "org.apache.logging.log4j:log4j-core",
    "org.apache.logging.log4j:log4j-api",
    "junit:junit",
    "org.junit.jupiter:junit-jupiter",
    "org.junit.jupiter:junit-jupiter-api",
    "org.junit.jupiter:junit-jupiter-engine",
    "org.mockito:mockito-core",
    "org.assertj:assertj-core",
    "org.projectlombok:lombok",
    "com.google.code.gson:gson",
    "org.apache.httpcomponents:httpclient",
    "com.squareup.okhttp3:okhttp",
    "com.squareup.retrofit2:retrofit",
    "org.hibernate:hibernate-core",
    "org.hibernate.orm:hibernate-core",
    "mysql:mysql-connector-java",
    "com.mysql:mysql-connector-j",
    "org.postgresql:postgresql",
    "com.h2database:h2",
    "org.jetbrains.kotlin:kotlin-stdlib",
    "org.jetbrains.kotlinx:kotlinx-coroutines-core",
    "io.netty:netty-all",
    "io.reactivex.rxjava3:rxjava",
    "com.google.dagger:dagger",
    "javax.servlet:javax.servlet-api",
    "jakarta.servlet:jakarta.servlet-api",
    "org.yaml:snakeyaml",
    "io.micrometer:micrometer-core",
    "org.apache.kafka:kafka-clients",
    "software.amazon.awssdk:s3",
    "com.amazonaws:aws-java-sdk-s3",
    "org.apache.poi:poi",
    "org.apache.poi:poi-ooxml",
    "com.google.protobuf:protobuf-java",
    "io.grpc:grpc-netty",
    "androidx.appcompat:appcompat",
    "androidx.core:core-ktx",
    "com.google.android.material:material",
    "org.testng:testng",
    "org.hamcrest:hamcrest",
    "org.springdoc:springdoc-openapi-starter-webmvc-ui"
  ]
};

// src/rules/lookalike-dependency.ts
var lookalikeDependencyRule = {
  id: "lookalike-dependency",
  description: "Flags added dependencies named one character away from a popular package.",
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.lookalikeDependencies;
    if (!ruleConfig.enabled) {
      return [];
    }
    const allowed = new Set(ruleConfig.allowed.map((name) => name.toLowerCase()));
    return files.flatMap((file) => {
      const ecosystem = manifestEcosystem(file.path);
      if (ecosystem === void 0 || file.patch === void 0) {
        return [];
      }
      const found = findLookalikes(ecosystem, declaredDependencies(file.path, file.patch).added, allowed);
      if (found.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const pairs = found.slice(0, 3).map((match2) => `${match2.name} (like ${match2.popular})`).join(", ");
      const more = found.length > 3 ? ` and ${found.length - 3} more` : "";
      return [
        {
          ruleId: "lookalike-dependency",
          title: "Dependency named like a popular package",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "add" : "adds"} ${pairs}${more}: ${found.length > 1 ? "names" : "a name"} one character away from a popular ${ecosystem} package, a common way to slip in a malicious one.`,
          recommendation: "Check that each name is the package that was meant. If it is, add it to rules.lookalikeDependencies.allowed."
        }
      ];
    });
  }
};
function findLookalikes(ecosystem, added, allowed) {
  const normalized = new Map(popularPackages[ecosystem].map((name) => [normalizePackageName(name, ecosystem), name]));
  const lookalikes = [];
  for (const { name, line } of added) {
    const key = normalizePackageName(name, ecosystem);
    if (key.startsWith("@") || key.length < 4 || normalized.has(key) || allowed.has(name.toLowerCase())) {
      continue;
    }
    for (const [candidate, original] of normalized) {
      if (candidate.length >= 4 && oneEditApart(key, candidate)) {
        lookalikes.push({ line, name, popular: original });
        break;
      }
    }
  }
  return lookalikes;
}
function oneEditApart(left, right) {
  if (left === right || Math.abs(left.length - right.length) > 1) {
    return false;
  }
  if (left.length === right.length) {
    const differences = [];
    for (let index2 = 0; index2 < left.length && differences.length <= 2; index2 += 1) {
      if (left[index2] !== right[index2]) {
        differences.push(index2);
      }
    }
    if (differences.length === 1) {
      const [index2 = 0] = differences;
      return !(/\d/.test(left[index2] ?? "") && /\d/.test(right[index2] ?? ""));
    }
    const [first = 0, second = 0] = differences;
    return differences.length === 2 && second === first + 1 && left[first] === right[second] && left[second] === right[first];
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) {
    index += 1;
  }
  return shorter.slice(index) === longer.slice(index + 1);
}

// src/rules/risky-dependency-version.ts
var maxListed = 3;
var compiledInput = /\.in$/i;
var riskyDependencyVersionRule = {
  id: "risky-dependency-version",
  description: "Flags dependencies moved to an older version or left open to any future release.",
  run({ files, config: config2 }) {
    if (!config2.rules.riskyDependencyVersions.enabled) {
      return [];
    }
    const byFile = /* @__PURE__ */ new Map();
    for (const change of dependencyChanges(files)) {
      const problem = describeProblem(change);
      if (problem !== void 0) {
        byFile.set(change.file, [...byFile.get(change.file) ?? [], problem]);
      }
    }
    return [...byFile].map(([file, problems]) => {
      const { text, plural } = describeLines(problems.map((problem) => problem.line));
      const listed = problems.slice(0, maxListed).map((problem) => problem.text).join("; ");
      const more = problems.length > maxListed ? `; and ${problems.length - maxListed} more` : "";
      const older = problems.some((problem) => problem.kind === "older");
      return {
        ruleId: "risky-dependency-version",
        title: older ? "Dependency moved to an older version" : "Dependency version left open",
        severity: "warning",
        file,
        line: Math.min(...problems.map((problem) => problem.line)),
        lines: problems.map((problem) => problem.line),
        message: `${text} ${plural ? "change" : "changes"} dependency versions: ${listed}${more}.`,
        recommendation: "Check why an older version is needed, since it can bring back fixed vulnerabilities, and keep versions bounded so a new release is reviewed before it is installed."
      };
    });
  }
};
function describeProblem(change) {
  if (change.line === void 0 || change.to === void 0) {
    return void 0;
  }
  const { from, to, name } = change;
  if (from !== void 0) {
    const before2 = versionNumbers(from);
    const after2 = versionNumbers(to);
    if (before2 !== void 0 && after2 !== void 0 && compareVersions(after2, before2) < 0) {
      return { line: change.line, kind: "older", text: `${name} from ${from} to ${to}, an older version` };
    }
    if (!compiledInput.test(change.file) && !isOpenEnded(from, change.ecosystem) && isOpenEnded(to, change.ecosystem)) {
      return { line: change.line, kind: "open", text: `${name} from ${from} to ${shown(to)}, which accepts any future release` };
    }
    return void 0;
  }
  const wildcard2 = (change.ecosystem === "npm" || change.ecosystem === "crates.io") && /^(?:\*|x|latest|next|)$/i.test(to.trim()) || change.ecosystem === "Maven" && to !== "" && isOpenEnded(to, change.ecosystem);
  if (wildcard2) {
    return { line: change.line, kind: "open", text: `${name} at ${shown(to)}, which accepts any release` };
  }
  return void 0;
}
function shown(version3) {
  return version3 === "" ? "no version" : version3;
}
function isOpenEnded(version3, ecosystem) {
  const spec = version3.trim();
  if (spec === "" && ecosystem === "Maven") {
    return false;
  }
  if (/^(?:\+|latest\.\w{1,20}|release)$/i.test(spec) || /^[[(][^,\])]{0,50},\s*\)$/.test(spec)) {
    return true;
  }
  if (/^(?:\*|x|latest|next|)$/i.test(spec)) {
    return true;
  }
  const parts = spec.split(/\s*,\s*|\s+(?=[<>=])/).filter(Boolean);
  return parts.length > 0 && !spec.includes("||") && parts.every((part) => /^>=?\s*v?\d/.test(part));
}
function versionNumbers(version3) {
  if (/:\/\/|^(?:git|file|link|workspace|npm|github)[:+]/i.test(version3.trim())) {
    return void 0;
  }
  const match2 = /(\d{1,9})(?:\.(\d{1,9}))?(?:\.(\d{1,9}))?/.exec(version3);
  return match2 === null ? void 0 : match2.slice(1).filter((part) => part !== void 0).map(Number);
}
function compareVersions(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

// src/analysis/lockfiles.ts
var lockfileNames = [
  [/(?:^|\/)package\.json$/, ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"]],
  [/(?:^|\/)pyproject\.toml$/i, ["poetry.lock", "uv.lock", "pdm.lock"]],
  [/(?:^|\/)Pipfile$/, ["Pipfile.lock"]],
  [/(?:^|\/)Gemfile$/, ["Gemfile.lock"]],
  [/(?:^|\/)Cargo\.toml$/, ["Cargo.lock"]],
  [/(?:^|\/)go\.mod$/, ["go.sum"]],
  [/(?:^|\/)composer\.json$/, ["composer.lock"]],
  [/(?:^|\/)[^/]+\.(?:cs|fs|vb)proj$/i, ["packages.lock.json"]],
  [/(?:^|\/)build\.gradle(?:\.kts)?$/, ["gradle.lockfile"]]
];
var ownDirectoryOnly = /\.(?:cs|fs|vb)proj$|(?:^|\/)build\.gradle(?:\.kts)?$/i;
function lockfilesFor(manifestPath) {
  return lockfileNames.find(([pattern]) => pattern.test(manifestPath))?.[1] ?? [];
}
function lockfileDirectories(manifestPath) {
  const parts = manifestPath.split("/").slice(0, -1);
  const directories = parts.map((_, index) => parts.slice(0, parts.length - index).join("/")).concat("");
  return ownDirectoryOnly.test(manifestPath) ? directories.slice(0, 1) : directories;
}
function joinPath(directory, name) {
  return directory === "" ? name : `${directory}/${name}`;
}

// src/rules/stale-lockfile.ts
var maxListed2 = 3;
var staleLockfileRule = {
  id: "stale-lockfile",
  description: "Flags dependency changes in a manifest whose lockfile the pull request does not update.",
  run({ files, config: config2, changedPaths, existingLockfiles }) {
    if (!config2.rules.staleLockfiles.enabled || existingLockfiles === void 0) {
      return [];
    }
    return files.flatMap((file) => {
      const names2 = lockfilesFor(file.path);
      const changes = names2.length === 0 || file.status === "removed" ? [] : dependencyChanges([file]);
      if (changes.length === 0) {
        return [];
      }
      const directory = lockfileDirectories(file.path).find(
        (candidate) => names2.some((name) => existingLockfiles.has(joinPath(candidate, name)))
      );
      if (directory === void 0 || names2.some((name) => changedPaths.has(joinPath(directory, name)))) {
        return [];
      }
      const lockfile = names2.map((name) => joinPath(directory, name)).find((path2) => existingLockfiles.has(path2)) ?? "";
      const lines = changes.flatMap((change) => change.line === void 0 ? [] : [change.line]);
      const listed = changes.slice(0, maxListed2).map(describe2).join(", ");
      const more = changes.length > maxListed2 ? ` and ${changes.length - maxListed2} more` : "";
      return [
        {
          ruleId: "stale-lockfile",
          title: "Lockfile not updated",
          severity: "warning",
          file: file.path,
          ...lines.length > 0 ? { line: Math.min(...lines), lines } : {},
          message: `This file changes dependencies (${listed}${more}), but ${lockfile}, which pins the versions that are installed, is not part of this pull request.`,
          recommendation: "Run the package manager's install or lock command and commit the updated lockfile, so CI and other developers install the reviewed versions."
        }
      ];
    });
  }
};
function describe2(change) {
  if (change.from === void 0) {
    return `${change.name} added`;
  }
  return change.to === void 0 ? `${change.name} removed` : `${change.name} changed`;
}

// src/rules/missing-tests.ts
var missingTestsRule = {
  id: "missing-tests",
  description: "Flags source changes that do not include matching test changes.",
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.missingTests;
    if (!ruleConfig.enabled) {
      return [];
    }
    const hasSourceChange = files.some(
      (file) => ruleConfig.sourceGlobs.some((glob) => minimatch(file.path, glob))
    );
    const hasTestChange = files.some(
      (file) => ruleConfig.testGlobs.some((glob) => minimatch(file.path, glob))
    );
    if (!hasSourceChange || hasTestChange) {
      return [];
    }
    return [
      {
        ruleId: "missing-tests",
        title: "Source changed without tests",
        severity: "warning",
        message: "Source files changed, but no test files were modified in this pull request.",
        recommendation: "Add or update tests for the modified behavior, or explain why existing coverage is sufficient."
      }
    ];
  }
};

// src/rules/oversized-patch.ts
var oversizedPatchRule = {
  id: "oversized-patch",
  description: "Reports files whose patch was too large to inspect.",
  run({ files }) {
    return files.filter((file) => file.patchOmitted).map((file) => ({
      ruleId: "oversized-patch",
      title: "Patch too large to inspect",
      severity: "info",
      file: file.path,
      message: "This file's patch exceeds the configured size limit, so its content was not inspected.",
      recommendation: "Review this file manually or split the change into smaller pull requests."
    }));
  }
};

// src/rules/privileged-container.ts
var privilegedFlag = ["--", "privileged"].join("");
var kinds2 = [
  {
    label: "runs a privileged container",
    high: true,
    pattern: new RegExp(String.raw`\bprivileged["']?\s*:\s*["']?true\b|${privilegedFlag}\b(?!=false)`, "i")
  },
  {
    label: "adds the SYS_ADMIN or ALL capability",
    high: true,
    pattern: /--cap-add[=\s]+["']?(?:CAP_)?(?:ALL|SYS_ADMIN)\b|\b(?:cap_add|add)\s*:\s*\[[^\]]{0,500}\b(?:CAP_)?(?:ALL|SYS_ADMIN)\b/
  },
  {
    // A mount of the socket, not a client setting such as DOCKER_HOST=unix:///var/run/docker.sock.
    label: "mounts the Docker socket",
    high: true,
    pattern: /(?:^\s*-\s*["']?|(?:-v|--volume)[=\s]+["']?|\b(?:source|src)=|\bpath:\s*["']?)\/(?:var\/)?run\/docker\.sock\b/
  },
  {
    label: "shares the host's network, process, or IPC namespace",
    high: false,
    pattern: /\bhost(?:Network|PID|IPC)\s*:\s*true\b|^\s*(?:network_mode|pid|ipc)\s*:\s*["']?host\b|--(?:net|network|pid|ipc|uts)[=\s]+host\b/
  },
  { label: "allows privilege escalation", high: false, pattern: /\ballowPrivilegeEscalation\s*:\s*true\b/ },
  { label: "runs as root", high: false, pattern: /\brunAsUser\s*:\s*0\b|\brunAsNonRoot\s*:\s*false\b/ }
];
var capabilityKind = kinds2[1];
var capabilityItem = /^\s*-\s*["']?(?:CAP_)?(?:ALL|SYS_ADMIN)["']?\s*(?:#.*)?$/;
var mappingKey = /^\s*([\w-]+)\s*:\s*(?:#.*)?$/;
var commentLine29 = /^\s*#/;
var documentation19 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var privilegedContainerRule = {
  id: "privileged-container",
  description: "Flags containers that run privileged, mount the Docker socket, or share the host's namespaces.",
  run({ files, config: config2 }) {
    if (!config2.rules.privilegedContainers.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation19.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findSettings(file.patch);
      if (found.length === 0) {
        return [];
      }
      const listed = kinds2.filter((kind) => found.some((match2) => match2.kind === kind));
      const high = listed.some((kind) => kind.high);
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const labels14 = listed.map((kind) => kind.label);
      return [
        {
          ruleId: "privileged-container",
          title: high ? "Privileged container added" : "Container isolation weakened",
          severity: high ? "high" : "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "weaken" : "weakens"} a container's isolation from its host: ${joinLabels3(labels14)}.`,
          recommendation: "Anything that breaks out of a privileged container, or reaches the Docker socket, controls the host. Grant only the capabilities the workload needs, run as a non-root user, and keep host namespaces and the Docker socket out unless the workload is trusted."
        }
      ];
    });
  }
};
function findSettings(patch) {
  const found = [];
  let listKey2 = "";
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      listKey2 = "";
    }
    if (commentLine29.test(content)) {
      continue;
    }
    const key = mappingKey.exec(content)?.[1];
    if (key !== void 0) {
      listKey2 = key;
    }
    if (!added) {
      continue;
    }
    for (const kind of kinds2) {
      if (kind.pattern.test(content)) {
        found.push({ line, kind });
      }
    }
    if (capabilityItem.test(content) && (listKey2 === "add" || listKey2 === "cap_add")) {
      found.push({ line, kind: capabilityKind });
    }
  }
  return found;
}
function joinLabels3(labels14) {
  return labels14.length > 1 ? `${labels14.slice(0, -1).join(", ")}, and ${labels14.at(-1)}` : labels14[0] ?? "";
}

// src/rules/dockerfile-risk.ts
var labels7 = {
  "unpinned-base": "a base image without a version tag or with `latest`",
  "remote-add": "a file downloaded by `ADD` without a checksum",
  "secret-variable": "a secret in `ENV` or `ARG`, which the image and its history keep",
  "root-user": "a final `USER` that runs the image as root"
};
var dockerfile = /(?:^|\/)(?:(?:Dockerfile|Containerfile)(?:\.[\w.-]{1,100})?|[\w.-]{1,100}\.(?:dockerfile|containerfile))$/i;
var instruction = /^\s*([A-Za-z]{2,11})\s+(.*)$/;
var commentLine30 = /^\s*#/;
var secretWords3 = /* @__PURE__ */ new Set(["password", "passwd", "secret", "token", "apikey", "credential", "credentials"]);
var secretPairs3 = [
  ["api", "key"],
  ["private", "key"],
  ["access", "key"],
  ["secret", "key"]
];
var locationWords = /* @__PURE__ */ new Set(["file", "path", "dir", "url", "uri", "endpoint", "host", "name", "id", "type", "header"]);
var dockerfileRiskRule = {
  id: "dockerfile-risk",
  description: "Flags unpinned base images, root users, unchecked downloads, and secrets in Dockerfiles.",
  run({ files, config: config2 }) {
    if (!config2.rules.dockerfileRisk.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !dockerfile.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findRisks(file.patch);
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels7).filter((kind) => found.some((match2) => match2.kind === kind));
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      return [
        {
          ruleId: "dockerfile-risk",
          title: "Risky Dockerfile change",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: [...new Set(found.map((match2) => match2.line))],
          message: `${text} ${plural ? "add" : "adds"} ${joinLabels4(listed.map((kind) => labels7[kind]))}.`,
          recommendation: "Pin base images to a version or digest, switch to a non-root USER before the image runs, give remote ADD sources a --checksum, and pass secrets with RUN --mount=type=secret, since ENV values and build arguments stay in the image and its history."
        }
      ];
    });
  }
};
function findRisks(patch) {
  const instructions = readInstructions(patch);
  const stages = /* @__PURE__ */ new Set();
  const found = [];
  for (const [index, { keyword, args, line, added }] of instructions.entries()) {
    if (keyword === "FROM") {
      const [image = "", ...rest] = args.replace(/--[\w-]{1,50}=\S{1,200}\s*/g, "").trim().split(/\s+/);
      const stage = /^as$/i.test(rest[0] ?? "") ? rest[1]?.toLowerCase() : void 0;
      if (added && isUnpinned(image, stages)) {
        found.push({ line, kind: "unpinned-base" });
      }
      if (stage !== void 0) {
        stages.add(stage);
      }
    }
    if (keyword === "USER" && added && isRoot(args) && !instructions.slice(index + 1).some((later) => later.keyword === "USER")) {
      found.push({ line, kind: "root-user" });
    }
    if (keyword === "ADD" && added && /(?:^|\s)https?:\/\//i.test(args) && !/--checksum=/i.test(args)) {
      found.push({ line, kind: "remote-add" });
    }
    if ((keyword === "ENV" || keyword === "ARG") && added && variableNames(keyword, args).some(isSecretName3)) {
      found.push({ line, kind: "secret-variable" });
    }
  }
  return found;
}
function readInstructions(patch) {
  const instructions = [];
  let current;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      current = void 0;
    }
    if (commentLine30.test(content)) {
      continue;
    }
    const continues = /\\\s*$/.test(content);
    const text = content.replace(/\\\s*$/, "");
    if (current !== void 0) {
      current.args = `${current.args} ${text.trim()}`;
      current.added ||= added;
    } else {
      const match2 = instruction.exec(text);
      if (match2 === null) {
        continue;
      }
      current = { keyword: (match2[1] ?? "").toUpperCase(), args: (match2[2] ?? "").trim(), line, added };
      instructions.push(current);
    }
    if (!continues) {
      current = void 0;
    }
  }
  return instructions;
}
function isUnpinned(image, stages) {
  const name = image.toLowerCase();
  if (name === "" || name.includes("$") || name === "scratch" || stages.has(name) || name.includes("@sha256:")) {
    return false;
  }
  const lastSegment = name.slice(name.lastIndexOf("/") + 1);
  const tag = lastSegment.includes(":") ? lastSegment.slice(lastSegment.indexOf(":") + 1) : "";
  return tag === "" || tag === "latest";
}
function isRoot(args) {
  const user = args.trim().split(/[\s:]/)[0] ?? "";
  return user === "root" || user === "0";
}
function variableNames(keyword, args) {
  if (keyword === "ENV" && !/^[\w.-]{1,200}=/.test(args)) {
    return [args.split(/\s/)[0] ?? ""];
  }
  const unquoted2 = args.replace(/"(?:[^"\\]|\\.){0,2000}"|'[^']{0,2000}'/g, "''");
  const name = keyword === "ENV" ? /(?:^|\s)([A-Za-z_][\w.-]{0,199})(?==)/g : /(?:^|\s)([A-Za-z_][\w.-]{0,199})(?==|\s|$)/g;
  return [...unquoted2.matchAll(name)].map((match2) => match2[1] ?? "");
}
function isSecretName3(name) {
  const words = name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[_.-]+/).filter((word2) => word2 !== "");
  if (words.length === 0 || locationWords.has(words[words.length - 1] ?? "") || words.includes("public")) {
    return false;
  }
  return words.some((word2) => secretWords3.has(word2)) || secretPairs3.some(([first, second]) => words.some((word2, index) => word2 === first && words[index + 1] === second));
}
function joinLabels4(labels14) {
  return labels14.length > 1 ? `${labels14.slice(0, -1).join(", ")}, and ${labels14.at(-1)}` : labels14[0] ?? "";
}

// src/rules/insecure-infrastructure.ts
var terraformFile = /\.(?:tf|tf\.json|hcl)$/i;
var templateFile = /\.(?:json|ya?ml)$/i;
var settings = [
  {
    label: "allows every action in an IAM policy",
    high: true,
    // `actions` in a policy document, `Action` in jsonencode(), and `"Action"` in heredoc JSON.
    terraform: /\bactions\s*=\s*\[\s*"\*(?::\*)?"\s*\]|(?:\bAction|"Action")\s*[=:]\s*(?:\[\s*)?"\*(?::\*)?"\s*(?:\]|,|$)/,
    cloudFormation: /["']?\bAction["']?\s*:\s*(?:\[\s*)?["']\*(?::\*)?["']\s*(?:\]|,|$)|^\s*Action\s*:\s*\*\s*$/
  },
  {
    label: "turns off encryption",
    high: false,
    terraform: /\b(?:encrypted|storage_encrypted|at_rest_encryption_enabled|transit_encryption_enabled|enable_https_traffic_only|https_traffic_only_enabled|encryption_enabled)\s*=\s*false\b/,
    cloudFormation: /\b(?:Encrypted|StorageEncrypted|AtRestEncryptionEnabled|TransitEncryptionEnabled|KmsEncrypted)["']?\s*:\s*["']?false\b/
  },
  {
    label: "allows TLS 1.0 or 1.1",
    high: false,
    terraform: /\b(?:min_tls_version|minimum_tls_version|minimal_tls_version)\s*=\s*"(?:TLS)?_?1[._][01]"/i
  },
  {
    label: "turns off audit logging",
    high: false,
    terraform: /\b(?:enable_logging|enable_log_file_validation)\s*=\s*false\b/,
    cloudFormation: /\b(?:IsLogging|EnableLogFileValidation)["']?\s*:\s*["']?false\b/
  },
  {
    label: "allows the instance metadata service without a token (IMDSv1)",
    high: false,
    terraform: /\bhttp_tokens\s*=\s*"optional"/,
    cloudFormation: /\bHttpTokens["']?\s*:\s*["']?optional\b/
  }
];
var allowsEverything = settings[0];
var commentLine31 = /^\s*(?:#|\/\/)/;
var effect2 = /\b[Ee]ffect["']?\s*[=:]\s*["']?(Allow|Deny)\b/;
var statementReach = 15;
var insecureInfrastructureRule = {
  id: "insecure-infrastructure",
  description: "Flags IAM policies that allow every action, and turned-off encryption, TLS, audit logging, and IMDSv2.",
  run({ files, config: config2 }) {
    if (!config2.rules.insecureInfrastructure.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const terraform = terraformFile.test(file.path);
      if (file.patch === void 0 || !terraform && !templateFile.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findSettings2(patchLines(file.patch), terraform);
      if (found.length === 0) {
        return [];
      }
      const listed = settings.filter((setting) => found.some((match2) => match2.setting === setting));
      const high = listed.some((setting) => setting.high);
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      return [
        {
          ruleId: "insecure-infrastructure",
          title: high ? "Policy allows every action" : "Infrastructure protection turned off",
          severity: high ? "high" : "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "change" : "changes"} infrastructure so that it ${joinLabels5(listed.map((setting) => setting.label))}.`,
          recommendation: 'Grant only the actions a role needs, keep encryption at rest and in transit on, require TLS 1.2 or later, keep audit logs on, and require IMDSv2 tokens with http_tokens = "required".'
        }
      ];
    });
  }
};
function findSettings2(lines, terraform) {
  const found = [];
  for (const [index, { line, content, added }] of lines.entries()) {
    if (!added || commentLine31.test(content)) {
      continue;
    }
    for (const setting of settings) {
      const pattern = terraform ? setting.terraform : setting.cloudFormation;
      if (pattern === void 0 || !pattern.test(content)) {
        continue;
      }
      if (setting === allowsEverything && nearestEffect(lines, index) === "Deny") {
        continue;
      }
      found.push({ line, setting });
    }
  }
  return found;
}
function nearestEffect(lines, index) {
  let first = index;
  while (first > 0 && !lines[first]?.startsHunk) {
    first -= 1;
  }
  let last = index;
  while (last + 1 < lines.length && !lines[last + 1]?.startsHunk) {
    last += 1;
  }
  for (let distance = 0; distance <= statementReach; distance += 1) {
    for (const candidate of [index - distance, index + distance]) {
      if (candidate < first || candidate > last) {
        continue;
      }
      const match2 = effect2.exec(lines[candidate]?.content ?? "")?.[1];
      if (match2 !== void 0) {
        return match2;
      }
    }
  }
  return void 0;
}
function joinLabels5(labels14) {
  return labels14.length > 1 ? `${labels14.slice(0, -1).join(", ")}, and ${labels14.at(-1)}` : labels14[0] ?? "";
}

// src/rules/kubernetes-rbac.ts
var labels8 = {
  "cluster-admin": "binds the cluster-admin role",
  anonymous: "grants a role to every user or to unauthenticated requests",
  "wildcard-verbs": "allows every verb",
  "wildcard-resources": "covers every resource",
  escalation: "allows the escalate, bind, or impersonate verbs, which grant more than the role holds"
};
var yamlFile = /\.ya?ml$/i;
var documentation20 = /(?:^|\/)docs?\//i;
var rbacMarker = /^\s*kind\s*:\s*["']?(?:Cluster)?Role(?:Binding)?["']?\s*$|^\s*(?:roleRef|apiGroups)\s*:/;
var listKey = /^\s*(?:-\s+)?(verbs|resources|apiGroups)\s*:\s*(.*)$/;
var listItem = /^\s*-\s*(.*?)\s*(?:#.*)?$/;
var wildcard = /^["']?\*["']?$/;
var clusterAdmin = /^\s*name\s*:\s*["']?cluster-admin["']?\s*(?:#.*)?$/;
var everyone = /^\s*(?:-\s+)?name\s*:\s*["']?system:(?:anonymous|unauthenticated|authenticated)["']?\s*(?:#.*)?$/;
var escalationVerbs = /* @__PURE__ */ new Set(["escalate", "bind", "impersonate"]);
var commentLine32 = /^\s*#/;
var kubernetesRbacRule = {
  id: "kubernetes-rbac",
  description: "Flags Kubernetes RBAC that binds cluster-admin, grants roles to everyone, or allows every verb or resource.",
  run({ files, config: config2 }) {
    if (!config2.rules.kubernetesRbac.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !yamlFile.test(file.path) || documentation20.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findGrants(file.patch);
      if (found.length === 0) {
        return [];
      }
      const kinds3 = new Set(found.map((match2) => match2.kind));
      const listed = Object.keys(labels8).filter((kind) => kinds3.has(kind));
      const high = kinds3.has("cluster-admin") || kinds3.has("anonymous") || kinds3.has("wildcard-verbs") && kinds3.has("wildcard-resources");
      const lines = [...new Set(found.map((match2) => match2.line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "kubernetes-rbac",
          title: high ? "Cluster-wide access granted" : "Broad Kubernetes permissions",
          severity: high ? "high" : "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "change" : "changes"} Kubernetes RBAC so that it ${joinLabels6(listed.map((kind) => labels8[kind]))}.`,
          recommendation: "List the verbs, resources, and API groups each role needs, bind service accounts to those roles instead of cluster-admin, and never bind roles to system:anonymous, system:unauthenticated, or system:authenticated."
        }
      ];
    });
  }
};
function findGrants(patch) {
  const lines = patchLines(patch);
  if (!lines.some((entry) => rbacMarker.test(entry.content) || rbacMarker.test(entry.hunkContext ?? ""))) {
    return [];
  }
  const found = [];
  let key;
  let keyIndent = 0;
  for (const { line, content, added, startsHunk } of lines) {
    if (startsHunk) {
      key = void 0;
    }
    if (commentLine32.test(content) || content.trim() === "") {
      continue;
    }
    const indent = content.length - content.trimStart().length;
    const entry = listKey.exec(content);
    let values = [];
    if (entry !== null) {
      key = entry[1];
      keyIndent = indent;
      values = inlineValues(entry[2] ?? "");
    } else if (key !== void 0 && listItem.test(content) && indent >= keyIndent) {
      values = [listItem.exec(content)?.[1] ?? ""];
    } else {
      key = void 0;
    }
    if (!added) {
      continue;
    }
    if (clusterAdmin.test(content)) {
      found.push({ line, kind: "cluster-admin" });
    }
    if (everyone.test(content)) {
      found.push({ line, kind: "anonymous" });
    }
    if (key === "verbs" && values.some((value) => wildcard.test(value))) {
      found.push({ line, kind: "wildcard-verbs" });
    }
    if (key === "resources" && values.some((value) => wildcard.test(value))) {
      found.push({ line, kind: "wildcard-resources" });
    }
    if (key === "verbs" && values.some((value) => escalationVerbs.has(value.replace(/["']/g, "")))) {
      found.push({ line, kind: "escalation" });
    }
  }
  return found;
}
function inlineValues(value) {
  const inline = /^\[([^\]]{0,1000})\]/.exec(value.trim())?.[1];
  return inline === void 0 ? [] : inline.split(",").map((item) => item.trim());
}
function joinLabels6(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/rules/file-permissions.ts
var labels9 = {
  "world-writable": "makes files writable by every user",
  setuid: "sets the setuid bit, so a program runs with its owner's rights",
  "open-umask": "sets a umask that leaves new files writable by every user"
};
var shellChmod = /\bchmod\s+(?:(?:-[A-Za-z]{1,10}|--[\w-]{1,30}(?:=\S{1,200})?)\s+){0,5}([0-7]{1,4}|[ugoa+=,\-rwxXst]{1,50})(?=\s|$|[;&|)'"])/g;
var dockerChmod = /--chmod=([0-7]{1,4}|[ugoa+=,\-rwxXst]{1,50})(?=\s|$)/g;
var chmodCall = /\b(?:chmod|Chmod|chmodSync|lchmod|fchmod)\s*\(\s*[^,()]{1,300},\s*(0o?[0-7]{3,4})\b/g;
var shellUmask = /(?:^|[\s;&|(])umask\s+(0{0,4}[0-7]{1,4})(?=\s|$|[;&|)])/g;
var umaskCall = /\b(?:umask|Umask)\s*\(\s*(0o?[0-7]{0,4}|0)\s*\)/g;
var commentLine33 = /^\s*(?:#|\/\/|\*|REM\b|::)/i;
var documentation21 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var filePermissionsRule = {
  id: "file-permissions",
  description: "Flags commands and code that make files writable by every user, set the setuid bit, or open the umask.",
  run({ files, config: config2 }) {
    if (!config2.rules.filePermissions.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation21.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = patchLines(file.patch).flatMap(
        ({ line, content, added }) => added && !commentLine33.test(content) ? kindsIn(content).map((kind) => ({ line, kind })) : []
      );
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels9).filter((kind) => found.some((match2) => match2.kind === kind));
      const lines = [...new Set(found.map((match2) => match2.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "file-permissions",
          title: "Unsafe file permissions",
          severity: "warning",
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "change" : "changes"} file permissions in a way that ${joinLabels7(listed.map((kind) => labels9[kind]))}.`,
          recommendation: "Grant the owner and group what they need, such as 755 for programs and 644 or 640 for data, keep the setuid bit off, and keep a umask of 022 or stricter. Shared temporary directories can use 1777, whose sticky bit stops users from deleting each other's files."
        }
      ];
    });
  }
};
function kindsIn(content) {
  const kinds3 = /* @__PURE__ */ new Set();
  for (const pattern of [shellChmod, dockerChmod, chmodCall]) {
    for (const match2 of content.matchAll(pattern)) {
      for (const kind of modeKinds(match2[1] ?? "")) {
        kinds3.add(kind);
      }
    }
  }
  for (const pattern of [shellUmask, umaskCall]) {
    for (const match2 of content.matchAll(pattern)) {
      if (pattern === umaskCall && /(?:=|return)\s*$/.test(content.slice(0, match2.index).replace(/[\w.]+$/, ""))) {
        continue;
      }
      const digits = (match2[1] ?? "").replace(/^0o/, "");
      const others = Number(digits.at(-1) ?? "0");
      if ((others & 2) === 0) {
        kinds3.add("open-umask");
      }
    }
  }
  return [...kinds3];
}
function modeKinds(mode) {
  const octal = /^(?:0o)?([0-7]{1,4})$/.exec(mode)?.[1];
  if (octal !== void 0) {
    const digits = octal.padStart(3, "0");
    const special = digits.length === 4 ? Number(digits[0]) : 0;
    const others = Number(digits.at(-1));
    return [
      // The sticky bit, as in 1777 for /tmp, keeps a shared directory safe to write to.
      ...(others & 2) !== 0 && (special & 1) === 0 ? ["world-writable"] : [],
      ...(special & 4) !== 0 ? ["setuid"] : []
    ];
  }
  const kinds3 = [];
  for (const clause of mode.split(",")) {
    const parts = /^([ugoa]*)([+=])([rwxXst]*)$/.exec(clause);
    if (parts === null) {
      continue;
    }
    const [, who = "", , permissions = ""] = parts;
    if (/[oa]/.test(who) && permissions.includes("w")) {
      kinds3.push("world-writable");
    }
    if ((who === "" || /[ua]/.test(who)) && permissions.includes("s")) {
      kinds3.push("setuid");
    }
  }
  return kinds3;
}
function joinLabels7(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/rules/insecure-web-config.ts
var labels10 = {
  cors: "lets any website read responses sent with the user's cookies, by allowing every origin together with credentials",
  cookie: "lets scripts read, or plain HTTP carry, a cookie, by turning off HttpOnly or Secure",
  samesite: "lets other websites send a cookie with the requests they make, by setting SameSite to None",
  debug: "turns on a debug mode that shows internals, or runs code, for whoever triggers an error"
};
var anyOrigin = [
  /\borigin\s*:\s*(?:true\b|["']\*["'])/,
  /Access-Control-Allow-Origin["']?\s*[,:=]\s*(?:["']\*["']|(?:req|request)\.headers?(?:\.origin|\[\s*["']origin["']\s*\]|\.get\(\s*["']origin["']))/i,
  /\bCORS_(?:ALLOW_ALL_ORIGINS|ORIGIN_ALLOW_ALL)\s*=\s*True\b/,
  /\borigins\s*=\s*["']\*["']/,
  /\ballowedOrigin(?:Pattern)?s\s*\(\s*"\*"\s*\)/,
  /\.SetIsOriginAllowed\(\s*_?\w*\s*=>\s*true\s*\)|\.AllowAnyOrigin\(\)/
];
var credentials = [
  /\bcredentials\s*:\s*true\b/,
  /Access-Control-Allow-Credentials["']?\s*[,:=]\s*["']?true\b/i,
  /\bCORS_ALLOW_CREDENTIALS\s*=\s*True\b/,
  /\bsupports_credentials\s*=\s*True\b/,
  /\ballowCredentials\s*(?:\(\s*true\s*\)|=\s*"true")/,
  /\.AllowCredentials\(\)/
];
var corsReach = 10;
var djangoSetting = /\bCORS_[A-Z_]{1,40}\s*=/;
var wholeCorsCall = /\bcors\s*\(\s*\{[^}]{0,1000}\}\s*\)/i;
var cookieFlags = [
  /\bhttpOnly\s*:\s*false\b/i,
  /\b(?:SESSION|CSRF)_COOKIE_(?:SECURE|HTTPONLY)\s*=\s*False\b/,
  /\bset_cookie\s*\([^)]{0,500}\b(?:httponly|secure)\s*=\s*False\b/,
  /\b(?:res|response|reply)\.cookie\s*\([^)]{0,500}\b(?:httpOnly|secure)\s*:\s*false\b/,
  // Java's Cookie. `setSecure(false)` on anything else, such as Tomcat's request, is not about a cookie.
  /\.setHttpOnly\s*\(\s*false\s*\)|\b\w*cookie\w*\.setSecure\s*\(\s*false\s*\)/i,
  /\bHttpOnly\s*=\s*false\b/
];
var sameSiteNone = [
  /\bsameSite\s*:\s*(?:["']none["']|false\b)/i,
  /\b(?:SESSION|CSRF|LANGUAGE)_COOKIE_SAMESITE\s*=\s*["']None["']/,
  /\bsame_site\s*[:=]>?\s*:none\b|\bcookies_same_site_protection\s*=\s*:none\b/,
  /\bSameSite\s*=\s*SameSiteMode\.None\b/,
  /\.(?:setSameSite|sameSite)\s*\(\s*"None"\s*\)|\bsame-site\s*[=:]\s*none\b/i,
  /["']samesite["']\s*=>\s*["']None["']|\bsession\.cookie_samesite\s*=\s*["']?None\b/i
];
var flaskDebug = /\.run\s*\([^)]{0,500}\b(?:debug|use_debugger)\s*=\s*True\b/;
var djangoDebug = /^\s*DEBUG\s*=\s*True\b/;
var railsLocalErrors = /\bconfig\.consider_all_requests_local\s*=\s*true\b/;
var djangoSettings = /(?:^|\/)settings(?:\/[\w.-]+|[\w.-]*)\.py$/;
var developmentPath = /(?:^|[\/_.-])(?:dev|develop|development|local|test|testing|ci|examples?|samples?|demos?)(?:[\/_.-]|$)/i;
var railsProduction = /(?:^|\/)config\/environments\/production\.rb$/;
var commentLine34 = /^\s*(?:#|\/\/|\*)/;
var documentation22 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var insecureWebConfigRule = {
  id: "insecure-web-config",
  description: "Flags CORS that allows every origin with credentials, cookies without HttpOnly or Secure, and debug modes in production.",
  run({ files, config: config2 }) {
    if (!config2.rules.insecureWebConfig.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation22.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findSettings3(file.path, file.patch);
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels10).filter((kind) => found.some((match2) => match2.kind === kind));
      const high = listed.includes("cors");
      const lines = [...new Set(found.map((match2) => match2.line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "insecure-web-config",
          title: high ? "CORS allows every origin with credentials" : "Insecure web configuration",
          severity: high ? "high" : "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "change" : "changes"} web configuration in a way that ${joinLabels8(listed.map((kind) => labels10[kind]))}.`,
          recommendation: "List the origins allowed to send credentials, keep HttpOnly, Secure, and SameSite Lax or Strict on session and authentication cookies, and turn debug modes on only in development settings."
        }
      ];
    });
  }
};
function findSettings3(path2, patch) {
  const lines = patchLines(patch).filter(({ content }) => !commentLine34.test(content));
  const found = [];
  const origins = lines.filter(({ content }) => anyOrigin.some((pattern) => pattern.test(content)));
  const withCredentials = lines.filter(({ content }) => credentials.some((pattern) => pattern.test(content)));
  const paired = (left, right) => left.line === right.line || !wholeCorsCall.test(left.content) && !wholeCorsCall.test(right.content) && (Math.abs(left.line - right.line) <= corsReach || djangoSetting.test(left.content) && djangoSetting.test(right.content));
  for (const origin of origins) {
    for (const credential of withCredentials.filter((entry) => paired(origin, entry))) {
      for (const entry of [origin, credential]) {
        if (entry.added) {
          found.push({ line: entry.line, kind: "cors" });
        }
      }
    }
  }
  const development = developmentPath.test(path2);
  const djangoProduction = djangoSettings.test(path2) && !development;
  for (const { line, content, added } of lines) {
    if (!added) {
      continue;
    }
    if (cookieFlags.some((pattern) => pattern.test(content))) {
      found.push({ line, kind: "cookie" });
    }
    if (sameSiteNone.some((pattern) => pattern.test(content))) {
      found.push({ line, kind: "samesite" });
    }
    if (
      // Example and development apps, such as Flask-AppBuilder's `examples/*/run.py`, run in debug mode on purpose.
      !development && flaskDebug.test(content) || djangoProduction && djangoDebug.test(content) || railsProduction.test(path2) && railsLocalErrors.test(content)
    ) {
      found.push({ line, kind: "debug" });
    }
  }
  return found;
}
function joinLabels8(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/rules/weak-crypto.ts
var labels11 = {
  "weak-hash": "hashes a secret with MD5 or SHA-1",
  "broken-cipher": "encrypts with DES, 3DES, RC4, RC2, or Blowfish",
  ecb: "encrypts in ECB mode, which shows where the plaintext repeats",
  "weak-random": "makes a secret value with a random generator that is not meant for security"
};
var secretWords4 = /* @__PURE__ */ new Set(["password", "passwd", "passphrase", "secret", "token", "nonce", "salt", "otp", "apikey", "csrf"]);
var secretPairs4 = [
  ["api", "key"],
  ["session", "id"],
  ["reset", "code"],
  ["verification", "code"]
];
var weakHash = /\bhashlib\.(?:md5|sha1)\s*\(|\bhashlib\.new\(\s*["'](?:md5|sha1)["']|\bcreateHash\(\s*["'](?:md5|sha1)["']|\bMessageDigest\.getInstance\(\s*"(?:MD5|SHA-?1)"|\b(?:md5|sha1)\s*\(\s*\$|\bDigest::(?:MD5|SHA1)\b|\b(?:MD5|SHA1)\.(?:Create|HashData)\(|\b(?:md5|sha1)\.(?:Sum|New)\(/;
var brokenCipher = /\bcreateCipher(?:iv)?\(\s*["'](?:des|des-ede3?|des3|rc4|rc2|bf|blowfish)(?:-[\w-]{1,20})?["']|\bCipher\.getInstance\(\s*"(?:DES|DESede|TripleDES|RC4|ARCFOUR|RC2|Blowfish)\b|\b(?:DES|DES3|ARC4|ARC2|Blowfish)\.new\(|\b(?:des\.New(?:TripleDES)?Cipher|rc4\.NewCipher)\(|\b(?:DES|TripleDES|RC2)\.Create\(/;
var ecbMode = /\bMODE_ECB\b|(?<!RSA)\/ECB\/|\bcreateCipher(?:iv)?\(\s*["'][\w-]{1,30}-ecb["']|\bCipher\.getInstance\(\s*"AES"\s*\)|\bCipherMode\.ECB\b|\bmodes\.ECB\(/;
var weakRandom = /\bMath\.random\(\)|\brandom\.(?:random|randint|randrange|choice|choices|sample|getrandbits)\(|\brand\(\)|\bmt_rand\(/;
var commentLine35 = /^\s*(?:#|\/\/|\*|--)/;
var minified = /\.min\.(?:js|mjs|cjs)$/i;
var maxLineLength24 = 500;
var documentation23 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var weakCryptoRule = {
  id: "weak-crypto",
  description: "Flags secrets hashed with MD5 or SHA-1, broken ciphers, ECB mode, and secrets made with non-cryptographic random numbers.",
  run({ files, config: config2 }) {
    if (!config2.rules.weakCrypto.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation23.test(file.path) || minified.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = patchLines(file.patch).flatMap(
        ({ line, content, added }) => added && !commentLine35.test(content) && content.length <= maxLineLength24 ? kindsIn2(content).map((kind) => ({ line, kind })) : []
      );
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels11).filter((kind) => found.some((match2) => match2.kind === kind));
      const lines = [...new Set(found.map((match2) => match2.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "weak-crypto",
          title: "Weak cryptography",
          severity: "warning",
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "use" : "uses"} cryptography that ${joinLabels9(listed.map((kind) => labels11[kind]))}.`,
          recommendation: "Hash passwords with bcrypt, scrypt, or Argon2, encrypt with AES-GCM or ChaCha20-Poly1305, and make tokens with a cryptographic generator such as crypto.randomBytes, secrets.token_urlsafe, or SecureRandom."
        }
      ];
    });
  }
};
function kindsIn2(content) {
  const secret = mentionsSecret(content);
  return [
    ...secret && weakHash.test(content) ? ["weak-hash"] : [],
    ...brokenCipher.test(content) ? ["broken-cipher"] : [],
    ...ecbMode.test(content) ? ["ecb"] : [],
    ...secret && weakRandom.test(content) ? ["weak-random"] : []
  ];
}
function mentionsSecret(content) {
  const words = content.split(/[^A-Za-z0-9]+/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)).filter(Boolean).map((word2) => word2.toLowerCase());
  return words.some((word2) => secretWords4.has(word2)) || secretPairs4.some(([first, second]) => words.some((word2, index) => word2 === first && words[index + 1] === second));
}
function joinLabels9(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/rules/xml-external-entities.ts
var settings2 = [
  // lxml and Python's SAX parser.
  /\b(?:resolve_entities|load_dtd)\s*=\s*True\b|\bno_network\s*=\s*False\b/,
  /\bsetFeature\(\s*(?:[\w.]{0,40}\.)?feature_external_(?:ges|pes)\s*,\s*(?:True|1)\s*\)/,
  // Java's DocumentBuilderFactory, SAXParserFactory, XMLInputFactory, and TransformerFactory.
  /\bsetFeature\(\s*"http:\/\/(?:apache\.org\/xml\/features\/disallow-doctype-decl"\s*,\s*false|xml\.org\/sax\/features\/external-(?:general|parameter)-entities"\s*,\s*true|apache\.org\/xml\/features\/nonvalidating\/load-external-dtd"\s*,\s*true)\s*\)/,
  /\bsetExpandEntityReferences\(\s*true\s*\)/,
  /\bsetProperty\(\s*(?:XMLInputFactory\.(?:SUPPORT_DTD|IS_SUPPORTING_EXTERNAL_ENTITIES)|"javax\.xml\.stream\.(?:supportDTD|isSupportingExternalEntities)")\s*,\s*(?:true|Boolean\.TRUE)\s*\)/,
  /\b(?:setAttribute|setProperty)\(\s*XMLConstants\.ACCESS_EXTERNAL_(?:DTD|SCHEMA|STYLESHEET)\s*,\s*"all"\s*\)/,
  // PHP's libxml.
  /\blibxml_disable_entity_loader\(\s*false\s*\)|\bLIBXML_(?:NOENT|DTDLOAD)\b|->(?:substituteEntities|resolveExternals)\s*=\s*true\b/i,
  // .NET's XmlReaderSettings and XmlDocument.
  /\bDtdProcessing\s*=\s*DtdProcessing\.Parse\b|\bProhibitDtd\s*=\s*false\b|\bXmlResolver\s*=\s*new\s+XmlUrlResolver\s*\(/,
  // libxmljs in Node.js.
  /\b(?:noent|dtdload)\s*:\s*true\b/,
  // Nokogiri and libxml-ruby.
  /\bconfig\.(?:noent|dtdload)\b|\b(?:ParseOptions|Options)::(?:NOENT|DTDLOAD)\b/
];
var commentLine36 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation24 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var xmlExternalEntitiesRule = {
  id: "xml-external-entities",
  description: "Flags XML parser settings that turn on DTDs or external entities, which let a document read local files or reach internal hosts.",
  run({ files, config: config2 }) {
    if (!config2.rules.xmlExternalEntities.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation24.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch).flatMap(
        ({ line, content, added }) => added && !commentLine36.test(content) && settings2.some((pattern) => pattern.test(content)) ? [line] : []
      );
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "xml-external-entities",
          title: "XML external entities turned on",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "turn" : "turns"} on DTDs or external entities in an XML parser, which lets a document read local files or reach internal hosts (XXE).`,
          recommendation: "Keep DTDs and external entities off for XML that comes from users or other systems: set disallow-doctype-decl to true in Java, leave resolve_entities and no_network at safe values in lxml or use defusedxml, drop the NOENT and DTDLOAD flags in PHP, and use DtdProcessing.Prohibit in .NET."
        }
      ];
    });
  }
};

// src/rules/mass-assignment.ts
var labels12 = {
  "permit-all": "permits every request parameter",
  "all-fields": "lets a form or serializer write every model field",
  unguarded: "makes every model attribute mass assignable",
  "whole-request": "passes the whole request body to a model"
};
var patterns = [
  // Rails strong parameters: `params.require(:user).permit!` and `params.to_unsafe_h`, but not after
  // `.slice(...)`, which already kept only the listed keys, as Devise does.
  ["permit-all", /^(?!.*\.slice\s*\().*(?:\.permi[t]!|\bparams\.to_unsafe_h(?:ash)?\b)/],
  // Laravel: an empty `$guarded` list, or `Model::unguard()`.
  ["unguarded", /\$guarded\s*=\s*(?:\[\s*\]|array\(\s*\))|\b\w+::unguard\s*\(\s*\)/],
  // Express with Mongoose, Sequelize, Prisma, or TypeORM: the body as the data of a write, or copied
  // onto a model.
  [
    "whole-request",
    /\.(?:create|insert|insertOne|insertMany|update|updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|upsert|build|save|merge|set)\s*\(\s*(?:[^,()]{1,200},\s*)?(?:\{\s*\.\.\.\s*)?(?:req|request|ctx\.request)\.body\s*\}?\s*[,)]|\bObject\.assign\s*\(\s*\w[\w.]*\s*,\s*(?:req|request|ctx\.request)\.body\s*\)|\bnew\s+[A-Z]\w*\s*\(\s*(?:req|request|ctx\.request)\.body\s*\)|\bdata\s*:\s*(?:req|request|ctx\.request)\.body\b/
  ],
  // Flask and Django: every field of the request as keyword arguments, such as `User(**request.json)`.
  ["whole-request", /\*\*\s*request\.(?:json|form|args|values|data|POST|GET|get_json\(\s*\))/],
  // ASP.NET MVC: TryUpdateModel without a list of properties binds every one of them.
  ["whole-request", /\bTryUpdateModel(?:Async)?(?:<[^>]{1,100}>)?\s*\(\s*\w+\s*\)/]
];
var digest = /\bcreate(?:Hash|Hmac)\b|\bhmac\b|\.digest\s*\(/i;
var allFields = /^\s*fields\s*=\s*["']__all__["']/;
var filterSet = /\bFilterSet\b|(?:^|\/)filters?\.py$/;
var commentLine37 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation25 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var massAssignmentRule = {
  id: "mass-assignment",
  description: `Flags code that lets a request set every field of a model, such as Rails' permit!, Django's fields = "__all__", or a model created from the whole request body.`,
  run({ files, config: config2 }) {
    if (!config2.rules.massAssignment.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation25.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const lines = patchLines(file.patch);
      const filters = filterSet.test(file.path) || lines.some(({ content }) => filterSet.test(content));
      const found = lines.flatMap(({ line, content, added }) => {
        if (!added || commentLine37.test(content)) {
          return [];
        }
        const kinds3 = patterns.filter(([kind, pattern]) => pattern.test(content) && !(kind === "whole-request" && digest.test(content))).map(([kind]) => kind);
        if (/\.py$/.test(file.path) && !filters && allFields.test(content)) {
          kinds3.push("all-fields");
        }
        return [...new Set(kinds3)].map((kind) => ({ line, kind }));
      });
      if (found.length === 0) {
        return [];
      }
      const listed = Object.keys(labels12).filter((kind) => found.some((match2) => match2.kind === kind));
      const numbers = [...new Set(found.map((match2) => match2.line))];
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "mass-assignment",
          title: "Mass assignment",
          severity: "warning",
          file: file.path,
          line: Math.min(...numbers),
          lines: numbers,
          message: `${text} ${plural ? "let" : "lets"} a request set fields it should not, such as a role or an owner: the code ${joinLabels10(listed.map((kind) => labels12[kind]))}.`,
          recommendation: "List the fields a request may set: permit(:name, :email) in Rails, an explicit fields list in Django forms and serializers, $fillable in Laravel, and picking the expected properties from the body before a create or update."
        }
      ];
    });
  }
};
function joinLabels10(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items[0] ?? "";
}

// src/analysis/regex-ambiguity.ts
var maxPatternLength2 = 2e3;
function ambiguousGroup(pattern) {
  if (pattern.length > maxPatternLength2) {
    return void 0;
  }
  let found;
  try {
    const parser = new Parser(pattern);
    const items = parser.sequence();
    const visit = (sequence) => {
      for (const item of sequence) {
        if (found !== void 0) {
          return;
        }
        if (item.kind === "group" && item.alternatives !== void 0) {
          if (isAmbiguous(item)) {
            found = item.source;
            return;
          }
          item.alternatives.forEach(visit);
        }
      }
    };
    visit(items);
  } catch {
    return void 0;
  }
  return found;
}
function isAmbiguous(group) {
  const quantifier = group.quantifier;
  if (quantifier === void 0 || quantifier.max !== Infinity || quantifier.possessive || group.atomic) {
    return false;
  }
  if (group.alternatives?.length !== 1) {
    return false;
  }
  const sequence = (group.alternatives[0] ?? []).filter((item) => item.kind !== "lookaround");
  const required2 = sequence.filter((item) => (item.quantifier?.min ?? 1) >= 1);
  const unbounded = sequence.filter((item) => item.quantifier?.max === Infinity && !item.quantifier.possessive && !item.atomic);
  if (unbounded.length === 0 || required2.length > 1) {
    return false;
  }
  const [anchor2] = required2;
  if (anchor2 === void 0 || unbounded.includes(anchor2)) {
    return true;
  }
  return unbounded.some((item) => overlaps(item, anchor2));
}
var probes = [..." !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~", "	", "\n", "\r", "\xE9", "\u4E2D"];
function overlaps(repeated, anchor2) {
  const firsts = firstAtoms(anchor2);
  if (repeated.kind !== "atom" || repeated.atom === void 0 || firsts === void 0) {
    return true;
  }
  const left = singleCharacter(repeated.atom);
  const rights = firsts.map(singleCharacter);
  if (left === void 0 || rights.some((right) => right === void 0)) {
    return true;
  }
  return probes.some((char) => left.test(char) && rights.some((right) => right?.test(char)));
}
function firstAtoms(item) {
  if (item.kind === "atom") {
    return item.atom === void 0 ? void 0 : [item.atom];
  }
  const atoms = [];
  for (const alternative of item.alternatives ?? []) {
    const start = alternative.find((entry) => entry.kind !== "lookaround");
    const nested = start === void 0 || (start.quantifier?.min ?? 1) === 0 ? void 0 : firstAtoms(start);
    if (nested === void 0) {
      return void 0;
    }
    atoms.push(...nested);
  }
  return atoms.length > 0 ? atoms : void 0;
}
function singleCharacter(atom) {
  try {
    return new RegExp(`^(?:${atom})$`, "u");
  } catch {
    try {
      return new RegExp(`^(?:${atom})$`);
    } catch {
      return void 0;
    }
  }
}
var Parser = class {
  constructor(text) {
    this.text = text;
  }
  text;
  index = 0;
  sequence() {
    return this.alternatives()[0] ?? [];
  }
  alternatives() {
    const alternatives = [[]];
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === ")") {
        break;
      }
      if (char === "|") {
        this.index += 1;
        alternatives.push([]);
        continue;
      }
      const start = this.index;
      const item = this.atom();
      item.atom = this.text.slice(start, this.index);
      item.quantifier = this.quantifier();
      item.source = this.text.slice(start, this.index);
      alternatives.at(-1)?.push(item);
    }
    return alternatives;
  }
  atom() {
    const char = this.text[this.index];
    if (char === "\\") {
      this.index += 2;
      return { kind: "atom", source: "" };
    }
    if (char === "[") {
      this.index += 1;
      if (this.text[this.index] === "^") {
        this.index += 1;
      }
      if (this.text[this.index] === "]") {
        this.index += 1;
      }
      while (this.index < this.text.length && this.text[this.index] !== "]") {
        this.index += this.text[this.index] === "\\" ? 2 : 1;
      }
      this.index += 1;
      return { kind: "atom", source: "" };
    }
    if (char === "(") {
      this.index += 1;
      let lookaround = false;
      let atomic = false;
      if (this.text[this.index] === "?") {
        const rest = this.text.slice(this.index, this.index + 4);
        lookaround = /^\?(?:[=!]|<[=!])/.test(rest);
        atomic = rest.startsWith("?>");
        const header2 = /^\?(?:P?<[A-Za-z_]\w*>|'[A-Za-z_]\w*'|<[=!]|[=!:>]|[a-zA-Z-]+[:)])/.exec(this.text.slice(this.index));
        this.index += header2?.[0].length ?? 1;
        if (header2?.[0].endsWith(")")) {
          return { kind: "lookaround", source: "" };
        }
      }
      const alternatives = this.alternatives();
      this.index += 1;
      return { kind: lookaround ? "lookaround" : "group", alternatives, atomic, source: "" };
    }
    this.index += 1;
    return { kind: "atom", source: "" };
  }
  quantifier() {
    const rest = this.text.slice(this.index);
    const match2 = /^(?:([*+?])|\{(\d+)(?:(,)(\d*))?\})([?+]?)/.exec(rest);
    if (match2 === null) {
      return void 0;
    }
    this.index += match2[0].length;
    const [, symbol, low, comma, high, suffix] = match2;
    const possessive = suffix === "+";
    if (symbol === "*") {
      return { min: 0, max: Infinity, possessive };
    }
    if (symbol === "+") {
      return { min: 1, max: Infinity, possessive };
    }
    if (symbol === "?") {
      return { min: 0, max: 1, possessive };
    }
    const min = Number(low);
    return { min, max: comma === void 0 ? min : high === "" ? Infinity : Number(high), possessive };
  }
};

// src/rules/redos.ts
var regexLiteral = /(?:^|[=(,:[!&|?{};]|\breturn|\bwhen|\bif|\bunless)\s*\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\[\n])+)\/[a-z]*/g;
var quoted2 = String.raw`(["'])((?:\\.|(?!\1)[^\\])*)\1`;
var regexCall = (prefix, rawPrefix = "") => new RegExp(String.raw`${prefix}\s*\(\s*(?:[^,()]{1,200},\s*)?(${rawPrefix})?(["'])((?:\\.|(?!\2)[^\\])*)\2`, "g");
var sources = (content, pattern, rawGroup, textGroup) => [...content.matchAll(pattern)].map((match2) => ({ pattern: match2[textGroup] ?? "", raw: rawGroup(match2) }));
var languages7 = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    find: (content) => [
      ...sources(content, regexLiteral, () => true, 1),
      ...sources(content, new RegExp(String.raw`\bRegExp\s*\(\s*${quoted2}`, "g"), () => false, 2)
    ]
  },
  {
    files: /\.pyi?$/,
    find: (content) => sources(content, regexCall(String.raw`\bre(?:gex)?\.(?:compile|match|fullmatch|search|findall|finditer|sub|subn|split)`, "[rRbB]{1,2}"), (match2) => /r/i.test(match2[1] ?? ""), 3)
  },
  {
    files: /\.rb$/,
    find: (content) => [
      ...sources(content, regexLiteral, () => true, 1),
      ...sources(content, new RegExp(String.raw`\bRegexp\.new\s*\(\s*${quoted2}`, "g"), (match2) => match2[1] === "'", 2)
    ]
  },
  {
    files: /\.(?:java|kt|scala)$/,
    find: (content) => sources(content, regexCall(String.raw`(?:\bPattern\.compile|\.matches|\.replaceAll|\.replaceFirst|\.split|\bRegex)`), () => false, 3)
  },
  {
    files: /\.cs$/,
    find: (content) => sources(content, regexCall(String.raw`(?:\bnew\s+Regex|\bRegex\.(?:IsMatch|Match|Matches|Replace|Split))`, "@"), (match2) => match2[1] === "@", 3)
  },
  {
    files: /\.php$/,
    find: (content) => sources(content, regexCall(String.raw`\bpreg_(?:match|match_all|replace|replace_callback|split|grep)`), (match2) => match2[2] === "'", 3).map(
      ({ pattern, raw }) => ({ pattern: withoutDelimiters(pattern), raw })
    )
  }
];
var commentLine38 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation26 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
var minified2 = /\.min\.(?:js|mjs|cjs)$/i;
var maxLineLength25 = 1e3;
var redosRule = {
  id: "redos",
  description: "Flags regular expressions with a repeated group that can match the same text in many ways, which can take exponential time on a crafted input.",
  run({ files, config: config2 }) {
    if (!config2.rules.redos.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages7.find(({ files: files2 }) => files2.test(file.path));
      if (language === void 0 || file.patch === void 0 || documentation26.test(file.path) || minified2.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = patchLines(file.patch).flatMap(({ line, content, added }) => {
        if (!added || commentLine38.test(content) || content.length > maxLineLength25) {
          return [];
        }
        const group = language.find(content).map(({ pattern, raw }) => ambiguousGroup(raw ? pattern : unescapeString(pattern))).find((match2) => match2 !== void 0);
        return group === void 0 ? [] : [{ line, group }];
      });
      if (found.length === 0) {
        return [];
      }
      const lines = found.map((match2) => match2.line);
      const { text, plural } = describeLines(lines);
      const example = found[0]?.group ?? "";
      return [
        {
          ruleId: "redos",
          title: "Regular expression open to ReDoS",
          severity: "warning",
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "add regular expressions" : "adds a regular expression"} with a repeated group that can match the same text in many ways, such as ${example.length > 60 ? `${example.slice(0, 57)}...` : example}, which can take exponential time on a crafted input (ReDoS).`,
          recommendation: "Make each repetition match text the others cannot, for example with a required separator such as (\\w+\\s)*, use an atomic group or possessive quantifier where the engine has them, limit the input length, or use a linear-time engine such as RE2."
        }
      ];
    });
  }
};
function unescapeString(text) {
  return text.replace(/\\\\/g, "\\");
}
function withoutDelimiters(pattern) {
  const delimiter = pattern[0];
  if (delimiter === void 0 || /[\w\s\\]/.test(delimiter)) {
    return pattern;
  }
  const closing = { "(": ")", "[": "]", "{": "}", "<": ">" }[delimiter] ?? delimiter;
  const end = pattern.lastIndexOf(closing);
  return end > 0 ? pattern.slice(1, end) : pattern;
}

// src/rules/public-exposure.ts
var infrastructureFile = /\.(?:tf|tf\.json|hcl|json|ya?ml)$/i;
var settings3 = [
  [
    "makes a storage bucket public",
    /\bacl\s*[=:]\s*["']public-read(?:-write)?["']|\bAccessControl["']?\s*:\s*["']?PublicRead(?:Write)?\b|\b(?:block_public_acls|block_public_policy|ignore_public_acls|restrict_public_buckets)\s*=\s*false\b|\b(?:BlockPublicAcls|BlockPublicPolicy|IgnorePublicAcls|RestrictPublicBuckets)["']?\s*:\s*["']?false\b|\b(?:allow_blob_public_access|allow_nested_items_to_be_public)\s*=\s*true\b/
  ],
  ["makes a database publicly accessible", /\bpublicly_accessible\s*=\s*true\b|\bPubliclyAccessible["']?\s*:\s*["']?true\b/],
  ["grants access to allUsers", /["'](?:allUsers|allAuthenticatedUsers)["']/]
];
var worldSource = /(?:^|[^\d.])0\.0\.0\.0\/0\b|(?:^|[^:\w])::\/0\b|\bsource_address_prefix\s*=\s*"(?:\*|Internet|Any)"|\bSourceAddressPrefix["']?\s*:\s*["']?(?:\*|Internet)\b/i;
var outbound = /egress|outbound/i;
var notInbound = /\b(?:type|direction)["']?\s*[=:]\s*["']?(?:egress|outbound)|\begress\s*=\s*true\b|\b(?:rule_action|access|Access|RuleAction)["']?\s*[=:]\s*["']?deny\b/i;
var sensitivePorts = [22, 23, 2375, 2376, 2379, 2380, 3306, 3389, 5432, 5601, 5900, 5984, 6379, 9042, 9200, 9300, 10250, 11211, 1433, 1521, 27017];
var publicExposureRule = {
  id: "public-exposure",
  description: "Flags infrastructure that opens sensitive ports to the internet or makes storage and databases public.",
  run({ files, config: config2 }) {
    if (!config2.rules.publicExposure.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || !infrastructureFile.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findExposure(file.patch, /\.ya?ml$/i.test(file.path));
      if (found.length === 0) {
        return [];
      }
      const ports = [...new Set(found.flatMap((match2) => match2.ports ?? []))].sort((left, right) => left - right);
      const labels14 = [
        ...settings3.map(([label]) => label).filter((label) => found.some((match2) => match2.label === label)),
        ...ports.length > 0 ? [`opens ${ports.length > 1 ? "ports" : "port"} ${ports.join(", ")} to the internet`] : [],
        ...found.some((match2) => match2.allPorts) ? ["opens every port to the internet"] : []
      ];
      const lines = found.map((match2) => match2.line);
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "public-exposure",
          title: "Resource exposed to the internet",
          severity: "high",
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "expose" : "exposes"} resources to the internet: ${joinLabels11(labels14)}.`,
          recommendation: "Limit the source to known address ranges or reach the service through a VPN, bastion, or private endpoint. Keep buckets and databases private, and serve public files through a CDN with read-only access."
        }
      ];
    });
  }
};
function findExposure(patch, yaml) {
  const found = [];
  const pending = [];
  let stack = [];
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      stack = [];
    }
    if (/^\s*(?:#|\/\/)/.test(content) || content.trim() === "") {
      continue;
    }
    let touched;
    if (yaml) {
      const indent = /^\s*/.exec(content)?.[0].length ?? 0;
      stack = stack.filter((block) => block.indent < indent);
      for (const block of stack) {
        block.lines.push(content);
      }
      if (/^\s*-\s/.test(content) || /:\s*$/.test(content)) {
        stack.push({ header: content, indent, lines: [content] });
      }
      touched = [...stack];
    } else {
      for (const block of stack) {
        block.lines.push(content);
      }
      touched = [...stack];
      for (const brace of content.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/[{}]/g) ?? []) {
        if (brace === "{") {
          const block = { header: content, indent: 0, lines: [content] };
          stack.push(block);
          touched.push(block);
        } else {
          stack.pop();
        }
      }
    }
    if (!added) {
      continue;
    }
    for (const [label, pattern] of settings3) {
      if (pattern.test(content)) {
        found.push({ line, label });
      }
    }
    if (worldSource.test(content)) {
      pending.push({ line, chain: touched.reverse() });
    }
  }
  for (const { line, chain } of pending) {
    if (chain.some((block2) => outbound.test(block2.header) || notInbound.test(block2.lines.join("\n")))) {
      continue;
    }
    const block = chain.find((candidate) => portsIn(candidate.lines) !== void 0);
    const ports = block === void 0 ? void 0 : portsIn(block.lines);
    if (ports === "all") {
      found.push({ line, allPorts: true });
    } else if (ports !== void 0) {
      const open2 = sensitivePorts.filter((port) => ports.some(([from, to]) => port >= from && port <= to));
      if (open2.length > 0) {
        found.push({ line, ports: open2 });
      }
    }
  }
  return found.sort((left, right) => left.line - right.line);
}
function portsIn(lines) {
  const text = lines.join("\n");
  if (/\b(?:protocol|IpProtocol)["']?\s*[=:]\s*["']?(?:-1|all)\b/i.test(text)) {
    return "all";
  }
  const ranges = [];
  const froms = [...text.matchAll(/\b(?:from_port|FromPort)["']?\s*[=:]\s*"?(\d+)/g)].map((match2) => Number(match2[1]));
  const tos = [...text.matchAll(/\b(?:to_port|ToPort)["']?\s*[=:]\s*"?(\d+)/g)].map((match2) => Number(match2[1]));
  froms.forEach((from, index) => ranges.push([from, tos[index] ?? from]));
  const values = [
    ...[...text.matchAll(/\b(?:port|Port|destination_port_range|DestinationPortRange)["']?\s*[=:]\s*["']?(\*|\d+(?:-\d+)?)/g)].map((match2) => match2[1] ?? ""),
    ...[...text.matchAll(/\b(?:ports|destination_port_ranges|DestinationPortRanges)["']?\s*[=:]\s*\[([^\]]{0,500})\]/g)].flatMap(
      (match2) => (match2[1] ?? "").split(",").map((value) => value.replace(/["'\s]/g, ""))
    )
  ].filter(Boolean);
  for (const value of values) {
    if (value === "*") {
      return "all";
    }
    const [from, to] = value.split("-").map(Number);
    if (from !== void 0 && !Number.isNaN(from)) {
      ranges.push([from, to ?? from]);
    }
  }
  return ranges.length > 0 ? ranges : void 0;
}
function joinLabels11(labels14) {
  return labels14.length > 1 ? `${labels14.slice(0, -1).join(", ")}, and ${labels14.at(-1)}` : labels14[0] ?? "";
}

// src/rules/remote-script.ts
var downloader = String.raw`(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString)`;
var shell = String.raw`(?:(?:(?:ba|z|da|k)?sh|iex|Invoke-Expression)\b|(?:python[23]?|node|perl|ruby)(?:\s+-)?\s*(?:$|[;&|)]))`;
var patterns2 = [
  // `curl ... | sh`, `wget -qO- ... | sudo -E bash -`, `... | sudo env A=1 bash`, `irm ... | iex`
  new RegExp(String.raw`\b${downloader}\b[^|;&\n]{0,2000}\|\s*(?:sudo\s+(?:-\S+\s+)*)?(?:env\s+(?:-\S+\s+|\w+=\S*\s+)*)?${shell}`, "i"),
  // `bash <(curl ...)`, `source <(curl ...)`
  /(?:^|[\s;&|(])(?:source|\.|(?:ba|z|k)?sh)\s+(?:-s\s+)?<\(\s*(?:curl|wget)\b/i,
  // `sh -c "$(curl ...)"`, `eval "$(curl ...)"`
  /\b(?:eval|(?:ba|z|k)?sh\s+-c)\s+["']?\$\(\s*(?:curl|wget)\b/i,
  // `iex (iwr ...)`, `iex ((New-Object Net.WebClient).DownloadString(...))`
  new RegExp(String.raw`\b(?:iex|Invoke-Expression)\s*\(+\s*(?:New-Object\b[^)]{0,200}\)\.)?${downloader}\b`, "i")
];
var commentLine39 = /^\s*(?:#|\/\/|REM\b|::)/i;
var documentation27 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var firstUrl2 = /\b(https?):\/\/([^\s"'|)/:\\]+)/i;
var remoteScriptRule = {
  id: "remote-script",
  description: "Flags commands that download a script and run it without checking it, such as curl | sh.",
  run({ files, config: config2 }) {
    if (!config2.rules.remoteScripts.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation27.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = commands(file.patch).flatMap(({ line, content }) => {
        if (!patterns2.some((pattern) => pattern.test(unquoted(content)))) {
          return [];
        }
        const url = firstUrl2.exec(content);
        return [{ line, host: url?.[2]?.toLowerCase(), insecure: url?.[1]?.toLowerCase() === "http" }];
      });
      if (found.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const hosts = [...new Set(found.flatMap((match2) => match2.host ?? []))];
      const sources2 = [
        ...hosts.slice(0, 3),
        ...hosts.length > 3 ? ["..."] : [],
        ...found.some((match2) => match2.host === void 0) ? ["a URL in a variable"] : []
      ].join(", ");
      const insecure = found.filter((match2) => match2.insecure).map((match2) => match2.line);
      const http = insecure.length > 0 ? `, and ${describeInsecure(insecure)} over plain HTTP` : "";
      return [
        {
          ruleId: "remote-script",
          title: "Downloaded script runs unchecked",
          severity: insecure.length > 0 ? "high" : "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "run scripts" : "runs a script"} downloaded from ${sources2} without checking ${plural ? "them" : "it"}${http}.`,
          recommendation: "Whoever controls the URL, or can intercept it, runs code here. Download the script to a file, check its checksum or signature, then run it, or install a pinned release from a package manager."
        }
      ];
    });
  }
};
function commands(patch) {
  const result = [];
  let parts = [];
  let firstAdded;
  const flush = () => {
    if (firstAdded !== void 0) {
      result.push({ line: firstAdded, content: parts.join(" ") });
    }
    parts = [];
    firstAdded = void 0;
  };
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      flush();
    }
    if (commentLine39.test(content)) {
      continue;
    }
    const continues = /\\\s*$/.test(content);
    parts.push(continues ? content.replace(/\\\s*$/, "") : content);
    if (added && firstAdded === void 0) {
      firstAdded = line;
    }
    if (!continues) {
      flush();
    }
  }
  flush();
  return result;
}
function describeInsecure(lines) {
  const { text, plural } = describeLines(lines);
  return `${text.charAt(0).toLowerCase()}${text.slice(1)} ${plural ? "download" : "downloads"}`;
}
function unquoted(content) {
  return content.replace(/'[^']*'/g, "''").replace(/"[^"$]*"/g, '""');
}

// src/rules/risky-api.ts
var slashComment = /^\s*(?:\/\/|\/\*|\*)/;
var hashComment = /^\s*#/;
var maxLineLength26 = 1e3;
var rawHtmlProp = ["dangerously", "SetInnerHTML"].join("");
var languages8 = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    comment: slashComment,
    calls: [
      ["eval", /(?<![.\w$])eval\s*\(|\b(?:window|globalThis|self)\.eval\s*\(/],
      ["Function constructor", /\bnew\s+Function\s*\(/],
      [
        "child_process exec",
        /(?<![.\w$])exe[c](?:Sync)?\s*\(|\b(?:child_process|childProcess|cp)\.exe[c](?:Sync)?\s*\(/
      ],
      ["shell option", /\bshell\s*:\s*true\b/],
      [rawHtmlProp, new RegExp(`\\b${rawHtmlProp}\\b`)],
      ["innerHTML assignment", /\.(?:inner|outer)HTML\s*\+?=(?!=)/],
      ["document.write", /\bdocument\.write(?:ln)?\s*\(/]
    ],
    definitions: /^\s*(?:(?:export|default|async|static|public|private|protected|override)\s+)*(?:function\s*\*?\s*)?(?:eval|exe[c](?:Sync)?)\s*\([^)]*\)\s*(?::[^{]*)?\{/
  },
  {
    files: /\.py$/,
    comment: hashComment,
    docstrings: true,
    calls: [
      ["eval", /(?<![.\w])eval\s*\(/],
      ["exec", /(?<![.\w])exe[c]\s*\(/],
      ["pickle", /\b(?:c?pickle|marshal|shelve)\.loads?\s*\(/],
      [
        "yaml.load",
        /\byaml\.(?:load(?:_all)?\s*\((?!.{0,500}\b(?:Safe|CSafe|Base)Loader\b)|unsafe_load(?:_all)?\s*\()/
      ],
      ["shell=True", /\bshell\s*=\s*True\b/],
      ["os.system", /\bos\.(?:system|popen)\s*\(/]
    ],
    definitions: /^\s*(?:async\s+)?def\s+\w+\s*\(/
  },
  {
    files: /\.(?:rb|rake|erb)$/,
    comment: hashComment,
    calls: [
      // A string, heredoc, or variable is evaluated; a `do` or `{` block is not.
      [
        "eval",
        /(?<![.\w:])(?:eval|instance_eval|class_eval|module_eval)\b\s*\(?\s*(?:["'`]|<<[~-]?|%[qQ]?[({[]|(?!do\b)[a-z_@$][\w@$]*)|\bKernel\.eval\b/
      ],
      // A command and its arguments as separate strings or a splat, as in `system("git", "status")` or
      // `system("git", *args)`, run without a shell; a single string goes through one, even with
      // options such as `exception: true` after it.
      [
        "shell command",
        /(?:(?<![.\w:])|(?<=\b(?:Kernel|Process)\.))(?:system|exe[c]|spawn)\b\s*[(\s]\s*(?:`|(["'])(?:\\.|(?!\1).)*\1(?!\s*,\s*["'*]))/
      ],
      // Backticks only run a command outside a string literal.
      ["interpolated shell command", /%x[({[]|^[^"'`]*(?:(?:"[^"]*"|'[^']*')[^"'`]*)*`[^`]*#\{/],
      ["Marshal.load", /\bMarshal\.load\b/],
      ["YAML.unsafe_load", /\b(?:YAML|Psych)\.unsafe_load\b/],
      ["html_safe or raw", /\.html_safe\b|(?<![.\w])raw\s*\(/]
    ],
    definitions: /^\s*def\s+/
  },
  {
    files: /\.(?:java|kt)$/,
    comment: slashComment,
    calls: [
      ["Runtime exec", /\bRuntime\.getRuntime\(\)\.exe[c]\s*\(/],
      [
        "shell command",
        /\bProcessBuilder\s*\(\s*(?:(?:List\.of|listOf|Arrays\.asList)\s*\()?\s*"(?:[^"]*\/)?(?:sh|bash|zsh|cmd(?:\.exe)?|powershell(?:\.exe)?)"\s*,\s*"(?:-[a-zA-Z]*c|\/[cC]|-Command)"/
      ],
      ["Java deserialization", /\b(?:ObjectInputStream|XMLDecoder)\s*\(/]
    ]
  },
  {
    // `->` and `::` mark method calls, which are excluded like member calls in JavaScript.
    files: /\.php$/,
    comment: /^\s*(?:\/\/|\/\*|\*|#(?!\[))/,
    calls: [
      ["eval", /(?<![>\w$:])eval\s*\(/],
      ["shell command", /(?<![>\w$:])(?:exe[c]|shell_exec|system|passthru|popen|proc_open)\s*\(/],
      ["unserialize", /(?<![>\w$:])unserialize\s*\(/]
    ],
    definitions: /^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+/
  },
  {
    files: /\.(?:cs|cshtml|razor)$/,
    comment: slashComment,
    calls: [
      [
        "shell command",
        /\b(?:Process\.Start\s*\(|FileName\s*=)\s*"(?:[^"]*[\/\\])?(?:cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh|sh|bash|zsh)"/
      ],
      ["unsafe .NET deserializer", /\b(?:BinaryFormatter|SoapFormatter|NetDataContractSerializer|LosFormatter|ObjectStateFormatter)\b/],
      ["Html.Raw", /\bHtml\.Raw\s*\(/]
    ]
  },
  {
    files: /\.swift$/,
    comment: slashComment,
    calls: [
      ["shell process", /(?:fileURLWithPath:|launchPath\s*=)\s*"\/bin\/(?:sh|bash|zsh)"/],
      ["NSKeyedUnarchiver", /\bNSKeyedUnarchiver\.unarchiveObject\s*\(|\bNSUnarchiver\b/],
      // `\(` inside the string is Swift interpolation.
      ["interpolated evaluateJavaScript", /\bevaluateJavaScript\s*\(\s*"[^"]*\\\(/]
    ]
  },
  {
    files: /\.go$/,
    comment: slashComment,
    calls: [
      [
        "shell command",
        /\bexec\.Command(?:Context)?\s*\((?:[^,"]{0,200},\s*)?"(?:[^"]*\/)?(?:sh|bash|zsh|dash|ksh|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh)"\s*,\s*"(?:-[a-zA-Z]*c|\/[cC]|-Command)"/
      ],
      ["template.HTML", /\btemplate\.HTML\s*\(/]
    ]
  }
];
var riskyApiRule = {
  id: "risky-api",
  description: "Flags added calls that run strings as code, start a shell, deserialize data, or write raw HTML.",
  run({ files, config: config2 }) {
    if (!config2.rules.riskyApis.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      const language = languages8.find((candidate) => candidate.files.test(file.path));
      if (!language || file.patch === void 0 || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const found = findCalls2(patchLines(file.patch), language);
      if (found.length === 0) {
        return [];
      }
      const kinds3 = [...new Set(found.map((match2) => match2.label))];
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      const many = plural || kinds3.length > 1;
      return [
        {
          ruleId: "risky-api",
          title: "Risky API call added",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: `${text} ${plural ? "add" : "adds"} ${many ? "calls that deserve" : "a call that deserves"} a security review: ${kinds3.join(", ")}.`,
          recommendation: "Check that no user or pull request input reaches these calls, and prefer a safer alternative such as JSON.parse, execFile with an argument list, yaml.safe_load, or textContent."
        }
      ];
    });
  }
};
function findCalls2(lines, language) {
  const code = language.docstrings ? outsideTripleQuotes(lines) : lines.map((line) => line.content);
  return lines.flatMap((line, index) => {
    const content = code[index] ?? "";
    if (!line.added || line.content.length > maxLineLength26 || language.comment.test(content) || language.definitions?.test(content)) {
      return [];
    }
    return language.calls.filter(([, pattern]) => pattern.test(content)).map(([label]) => ({ line: line.line, label }));
  });
}
function outsideTripleQuotes(lines) {
  let open2;
  return lines.map((line) => {
    if (line.startsHunk) {
      open2 = void 0;
    }
    let code = "";
    let rest = line.content;
    while (rest.length > 0) {
      if (open2 !== void 0) {
        const end = rest.indexOf(open2);
        if (end === -1) {
          break;
        }
        rest = rest.slice(end + 3);
        open2 = void 0;
        continue;
      }
      const start = /"""|'''/.exec(rest);
      if (start === null) {
        code += rest;
        break;
      }
      code += rest.slice(0, start.index);
      open2 = start[0];
      rest = rest.slice(start.index + 3);
    }
    return code;
  });
}

// src/security/detect-secrets.ts
var privateKeyHeader = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g;
var detectedFormats = [...credentialFormats, { kind: "private key", pattern: privateKeyHeader }];
var keyMaterial = /[A-Za-z0-9+/]{40,}/;
var materialAfterHeader = /^(?:\\[rn]|[\s"'`+,])*[A-Za-z0-9][A-Za-z0-9+/]{39,}/;
var materialWindow = 6;
var documentedExample = /^AKIA[0-9A-Z]{9}EXAMPLE$/;
function detectSecrets(files, allowlist2 = []) {
  return files.map((file) => ({
    ...file,
    secrets: file.patch === void 0 ? [] : findAddedSecrets(file.patch, allowlist2)
  }));
}
function findAddedSecrets(patch, allowlist2 = []) {
  const lines = addedLines(patch);
  return lines.flatMap(
    ({ line, content }, index) => matchingKinds(content, allowlist2).filter((kind) => kind !== "private key" || hasKeyMaterial(lines, index)).map((kind) => ({ line, kind }))
  );
}
function matchingKinds(content, allowlist2) {
  return detectedFormats.filter(
    ({ pattern }) => [...content.matchAll(pattern)].some(([match2]) => !isAllowlisted(match2, allowlist2) && !documentedExample.test(match2))
  ).map(({ kind }) => kind);
}
function hasKeyMaterial(lines, index) {
  const header2 = lines[index];
  if (header2 === void 0) {
    return false;
  }
  const sameLine = [...header2.content.matchAll(privateKeyHeader)].some(
    (match2) => materialAfterHeader.test(header2.content.slice(match2.index + match2[0].length))
  );
  if (sameLine) {
    return true;
  }
  return lines.slice(index + 1, index + 1 + materialWindow).some(({ line, content }) => line - header2.line <= materialWindow && keyMaterial.test(content));
}

// src/rules/secret-in-diff.ts
var secretInDiffRule = {
  id: "secret-in-diff",
  seesIgnoredFiles: true,
  description: "Flags added lines that contain a value in a known credential format.",
  run({ files, config: config2 }) {
    if (!config2.rules.secretInDiff.enabled) {
      return [];
    }
    const allowlist2 = config2.security.redaction.allowlist.map((source) => new RegExp(source));
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.map((file) => ({ file, secrets: secretsIn(file, allowlist2) })).map(({ file, secrets }) => ({
      file,
      secrets: isSamplePath(file.path, testGlobs) ? secrets.filter((secret) => secret.kind !== "private key") : secrets
    })).filter(({ secrets }) => secrets.length > 0).map(({ file, secrets }) => ({
      ruleId: "secret-in-diff",
      title: "Possible secret added",
      severity: "high",
      file: file.path,
      line: Math.min(...secrets.map((secret) => secret.line)),
      message: describe3(
        secrets.map((secret) => secret.line),
        [...new Set(secrets.map((secret) => secret.kind))]
      ),
      recommendation: "Treat the credential as exposed: revoke or rotate it, remove it from the branch history, and load it from a secret store. If it is a known test value, add a pattern for it to security.redaction.allowlist."
    }));
  }
};
function secretsIn(file, allowlist2) {
  if (file.secrets !== void 0) {
    return file.secrets;
  }
  return file.patch === void 0 ? [] : findAddedSecrets(file.patch, allowlist2);
}
var sampleDirectory2 = /(?:^|\/)(?:examples?|samples?|demos?|docs?|test[-_]fixtures|_fixtures?|testcerts)\//i;
var documentation28 = /\.(?:md|mdx|markdown|rst|adoc|asciidoc)$/i;
function isSamplePath(path2, testGlobs) {
  return isTestDataPath(path2) || sampleDirectory2.test(path2) || documentation28.test(path2) || testGlobs.some((glob) => minimatch(path2, glob));
}
function describe3(lines, kinds3) {
  const { text, plural } = describeLines(lines);
  if (!plural && kinds3.length === 1) {
    return `${text} adds what looks like ${article(kinds3[0] ?? "")} ${kinds3[0]}. The value is redacted from this review.`;
  }
  return `${text} ${plural ? "add" : "adds"} values that look like credentials (${kinds3.join(", ")}). The values are redacted from this review.`;
}
function article(kind) {
  return /^[AEIOU]/i.test(kind) ? "an" : "a";
}

// src/rules/sensitive-files.ts
var sensitiveWords = [
  "auth",
  "permission",
  "role",
  "session",
  "token",
  "jwt",
  "billing",
  "payment",
  "secret",
  "migration",
  "workflow",
  "dockerfile"
];
var unrelatedWord = /^(?:co)?author(?!i[sz])|tokeni[sz]|parole|secretar/;
var documentation29 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var sensitiveFilesRule = {
  id: "sensitive-files",
  description: "Flags changes to files that often require careful human review.",
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.sensitiveFiles;
    if (!ruleConfig.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    const describesOnly = (path2) => documentation29.test(path2) || isTestDataPath(path2) || testGlobs.some((glob) => minimatch(path2, glob));
    return files.flatMap((file) => {
      if (ruleConfig.patterns.some((pattern) => minimatch(file.path, pattern, { matchBase: true }))) {
        return [finding(file.path, "high", "This file touches an area that commonly affects security, deployment, data integrity, or access control.")];
      }
      if (hasSensitiveWord(file.path) && !describesOnly(file.path)) {
        return [finding(file.path, "warning", "This file's path names an area that commonly affects security, deployment, data integrity, or access control.")];
      }
      return [];
    });
  }
};
function finding(file, severity, message) {
  return {
    ruleId: "sensitive-files",
    title: "Sensitive file changed",
    severity,
    file,
    message,
    recommendation: "Ask for focused review from someone familiar with this area and verify rollback or mitigation steps."
  };
}
function hasSensitiveWord(path2) {
  return pathWords(path2).some(
    (word2) => !unrelatedWord.test(word2) && sensitiveWords.some((sensitive) => word2.includes(sensitive))
  );
}
function pathWords(path2) {
  return path2.split(/[^A-Za-z0-9]+/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)).filter(Boolean).map((word2) => word2.toLowerCase());
}

// src/rules/unpinned-action.ts
var workflowFile = /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/;
var usesLine = /^\s*(?:-\s*)?uses:\s*["']?([^"'\s#]+)/;
var commitSha = /^[0-9a-f]{40}$/i;
var maxListed3 = 3;
var unpinnedActionRule = {
  id: "unpinned-action",
  description: "Flags third-party actions and container images in workflows that are not pinned to a commit SHA or digest.",
  // A path setting must not hide a change to what a workflow runs.
  seesIgnoredFiles: true,
  run({ files, config: config2 }) {
    const ruleConfig = config2.rules.unpinnedActions;
    if (!ruleConfig.enabled) {
      return [];
    }
    const allowedOwners = new Set(ruleConfig.allowedOwners.map((owner) => owner.toLowerCase()));
    return files.flatMap((file) => {
      if (file.patch === void 0 || !workflowFile.test(file.path)) {
        return [];
      }
      const found = addedLines(file.patch).flatMap(({ line, content }) => {
        const target = usesLine.exec(content)?.[1];
        const kind = target === void 0 ? void 0 : unpinnedKind(target, allowedOwners);
        return kind === void 0 || target === void 0 ? [] : [{ line, kind, target }];
      });
      if (found.length === 0) {
        return [];
      }
      const actions = unique(found.filter((match2) => match2.kind === "action").map((match2) => match2.target));
      const images = unique(found.filter((match2) => match2.kind === "image").map((match2) => match2.target));
      const parts = [
        actions.length > 0 ? `${actions.length > 1 ? "actions" : "an action"} by a tag or branch that can be moved to other code (${list(actions)})` : "",
        images.length > 0 ? `${images.length > 1 ? "container images" : "a container image"} without a digest (${list(images)})` : ""
      ].filter(Boolean);
      const { text, plural } = describeLines(found.map((match2) => match2.line));
      return [
        {
          ruleId: "unpinned-action",
          title: "Action not pinned to a commit",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          message: `${text} ${plural ? "use" : "uses"} ${parts.join(", and ")}.`,
          recommendation: "Pin each action to the full commit SHA of a release, with the tag in a comment (uses: owner/action@<sha> # v4.2.0), and each image to a digest. Dependabot and Renovate can keep pinned versions up to date."
        }
      ];
    });
  }
};
function unpinnedKind(target, allowedOwners) {
  if (target.startsWith("./") || target.includes("${{")) {
    return void 0;
  }
  if (target.startsWith("docker://")) {
    return target.includes("@sha256:") ? void 0 : "image";
  }
  const at = target.lastIndexOf("@");
  if (at < 0) {
    return void 0;
  }
  const owner = target.slice(0, target.indexOf("/")).toLowerCase();
  return allowedOwners.has(owner) || commitSha.test(target.slice(at + 1)) ? void 0 : "action";
}
function unique(values) {
  return [...new Set(values)];
}
function list(targets) {
  const shown2 = targets.filter((target) => /^[\w.:/@-]{1,200}$/.test(target)).slice(0, maxListed3);
  const more = targets.length - shown2.length;
  return [...shown2, ...more > 0 ? [`${more} more`] : []].join(", ");
}

// src/rules/workflow-risk.ts
var workflowFile2 = /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/;
var workflowOnly = /^\.github\/workflows\//;
var topLevelPermissions = /^permissions\s*:\s*(?:#.*)?$/;
var inlineTopLevelPermissions = /^permissions\s*:\s*\{([^}]{0,1000})\}/;
var writeScope = /^\s+([\w-]{1,50})\s*:\s*["']?write\b/;
var untrustedPaths = [
  "github.head_ref",
  "github.event.issue.title",
  "github.event.issue.body",
  "github.event.pull_request.title",
  "github.event.pull_request.body",
  "github.event.pull_request.head.ref",
  "github.event.pull_request.head.label",
  "github.event.pull_request.head.repo.default_branch",
  "github.event.comment.body",
  "github.event.review.body",
  "github.event.review_comment.body",
  "github.event.discussion.title",
  "github.event.discussion.body",
  "github.event.pages.*.page_name",
  "github.event.commits.*.message",
  "github.event.commits.*.author.email",
  "github.event.commits.*.author.name",
  "github.event.head_commit.message",
  "github.event.head_commit.author.email",
  "github.event.head_commit.author.name",
  "github.event.workflow_run.head_branch",
  "github.event.workflow_run.head_commit.message",
  "github.event.workflow_run.head_commit.author.email",
  "github.event.workflow_run.head_commit.author.name"
].map((path2) => path2.split("."));
var scriptKeys = /* @__PURE__ */ new Set(["run", "script"]);
var mapping = /^(\s*)(?:-\s+)?([\w.-]+)\s*:(?:\s+(.*))?$/;
var blockScalar = /^[|>][+-]?\d*\s*(?:#.*)?$/;
var warnings = [
  ["pull_request_target trigger", /^\s*(?:-\s*)?pull_request_target\s*:?\s*(?:#.*)?$|^\s*on\s*:.*\bpull_request_target\b/],
  ["write-all permissions", /^\s*permissions:\s*write-all\b/],
  [
    "checkout of pull request code",
    /^\s*ref:\s*.*(?:\bgithub\.event\.pull_request\.head\.(?:sha|ref)\b|\bgithub\.head_ref\b|refs\/pull\/)/
  ]
];
var workflowRiskRule = {
  id: "workflow-risk",
  description: "Flags script injection, risky triggers, and broad permissions added to GitHub Actions workflows.",
  // A path setting must not be able to hide script injection.
  seesIgnoredFiles: true,
  run({ files, config: config2 }) {
    if (!config2.rules.workflowRisk.enabled) {
      return [];
    }
    return files.filter((file) => file.patch !== void 0 && workflowFile2.test(file.path)).flatMap((file) => {
      const injections = findInjections(file.patch ?? "");
      const flagged = matchAddedLines(file.patch ?? "", warnings, /^\s*#/);
      const workflow = workflowOnly.test(file.path);
      const writes = workflow ? findTopLevelWrites(file.patch ?? "") : [];
      const scopes = [...new Set(writes.flatMap(({ scopes: scopes2 }) => scopes2))];
      const unset = workflow && file.status === "added" && setsNoPermissions(file.patch ?? "");
      const lines = [
        ...injections.map(({ line }) => line),
        ...flagged.map(({ line }) => line),
        ...writes.map(({ line }) => line),
        ...unset ? [1] : []
      ];
      if (lines.length === 0) {
        return [];
      }
      const contexts = [...new Set(injections.flatMap(({ contexts: contexts2 }) => contexts2))];
      const labels14 = [
        ...contexts.length > 0 ? [`untrusted input in a script (${contexts.join(", ")})`] : [],
        ...new Set(flagged.map(({ label }) => label)),
        ...scopes.length > 0 ? [`write permissions for every job (${scopes.join(", ")})`] : [],
        ...unset ? ["a new workflow that sets no permissions, so its jobs get the repository's default token permissions"] : []
      ];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "workflow-risk",
          title: "Risky workflow change",
          severity: contexts.length > 0 ? "high" : "warning",
          file: file.path,
          line: Math.min(...lines),
          lines: [...new Set(lines)].sort((left, right) => left - right),
          message: `${text} ${plural ? "add" : "adds"} risky workflow configuration: ${labels14.join(", ")}.`,
          recommendation: "Pass untrusted values through env variables instead of ${{ }} in scripts, avoid running pull request code under pull_request_target, and set read-only permissions at the top of the workflow, granting write permissions such as contents or id-token only to the jobs that need them."
        }
      ];
    });
  }
};
function findTopLevelWrites(patch) {
  const found = [];
  let inBlock = false;
  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    if (startsHunk) {
      inBlock = topLevelPermissions.test(hunkContext ?? "");
    }
    if (/^\s*(?:#.*)?$/.test(content)) {
      continue;
    }
    if (!/^\s/.test(content)) {
      inBlock = topLevelPermissions.test(content);
      const inline = inlineTopLevelPermissions.exec(content)?.[1];
      const scopes = [...(inline ?? "").matchAll(/([\w-]{1,50})\s*:\s*["']?write\b/g)].map((match2) => match2[1] ?? "");
      if (added && scopes.length > 0) {
        found.push({ line, scopes });
      }
      continue;
    }
    const scope = inBlock ? writeScope.exec(content)?.[1] : void 0;
    if (added && scope !== void 0) {
      found.push({ line, scopes: [scope] });
    }
  }
  return found;
}
function setsNoPermissions(patch) {
  const content = patchLines(patch).map((entry) => entry.content);
  return !content.some((text) => /^\s*permissions\s*:/.test(text)) && !content.some((text) => /\bworkflow_call\b/.test(text) && !/^\s*#/.test(text));
}
function findInjections(patch) {
  const found = [];
  let block;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      block = void 0;
    }
    const indent = content.length - content.trimStart().length;
    if (block && content.trim() !== "" && indent <= block.indent) {
      block = void 0;
    }
    let executed;
    if (block) {
      executed = block.script;
    } else {
      const entry = mapping.exec(content);
      const key = entry?.[2];
      const value = entry?.[3] ?? "";
      executed = key === void 0 || scriptKeys.has(key);
      if (entry && key && blockScalar.test(value)) {
        block = { indent: (entry[1] ?? "").length + (/^\s*-\s+/.test(content) ? content.trimStart().indexOf(key) : 0), script: scriptKeys.has(key) };
      }
    }
    if (!added || /^\s*#/.test(content)) {
      continue;
    }
    const contexts = executed ? untrustedContexts(content) : [];
    if (contexts.length > 0) {
      found.push({ line, contexts });
    }
  }
  return found;
}
function untrustedContexts(text) {
  const contexts = [];
  for (const [, expression = ""] of text.matchAll(/\$\{\{([\s\S]{0,2000}?)\}\}/g)) {
    const normalized = expression.replace(/\[\s*['"]([\w-]+)['"]\s*\]/g, ".$1").replace(/\[\s*\d+\s*\]/g, ".*");
    for (const [path2] of normalized.matchAll(/\bgithub(?:\.[\w*-]+)*/g)) {
      if (isUntrusted(path2.split("."))) {
        contexts.push(path2);
      }
    }
  }
  return contexts;
}
function isUntrusted(path2) {
  return untrustedPaths.some(
    (untrusted) => path2.length <= untrusted.length && path2.every((segment, index) => untrusted[index] === "*" || untrusted[index] === segment)
  );
}

// src/rules/skipped-tests.ts
var notMember = String.raw`(?<![.\w$])`;
var languages9 = [
  {
    // Jest, Vitest, Mocha, Jasmine, and node:test.
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    markers: [
      ["focused", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.only(?:\.each)?\s*[(\x60]`)],
      ["focused", new RegExp(String.raw`${notMember}(?:fdescribe|fit)\s*\(`)],
      ["skipped", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.skip(?:\.each)?\s*[(\x60]`)],
      ["skipped", new RegExp(String.raw`${notMember}(?:xdescribe|xcontext|xit|xtest)\s*\(`)]
    ]
  },
  {
    // pytest and unittest, including conditional skips.
    files: /\.pyi?$/,
    markers: [
      ["skipped", /@(?:pytest\.mark\.skip(?:if)?|unittest\.skip(?:If|Unless)?)\b/],
      ["skipped", /\bpytest\.skip\s*\(/]
    ]
  },
  {
    // t.Skip, b.Skip, s.T().Skip, and their f and Now variants.
    files: /\.go$/,
    markers: [["skipped", /\.Skip(?:f|Now)?\s*\(/]]
  },
  {
    // `#[ignore]` only applies to tests, and Rust keeps unit tests inside source files.
    files: /\.rs$/,
    markers: [["skipped", /#\[ignore\b/]],
    anyFile: true
  },
  {
    // RSpec and Minitest. RSpec blocks take no parentheses, so markers start the line.
    files: /\.rb$/,
    markers: [
      ["focused", /^\s*f(?:it|describe|context|specify|example|scenario|feature)\b(?!\s*=)|\bfocus:\s*true\b|,\s*:focus\b/],
      ["skipped", /^\s*x(?:it|describe|context|specify|example|scenario|feature)\b(?!\s*=)|^\s*(?:skip|pending)\b(?!\s*[=:.])/]
    ]
  },
  {
    // JUnit 4 and 5, and TestNG.
    files: /\.(?:java|kt)$/,
    markers: [["skipped", /^\s*@(?:Disabled|Ignore)\b|@Test\s*\(\s*enabled\s*=\s*false\b/]]
  },
  {
    // xUnit, NUnit, and MSTest.
    files: /\.cs$/,
    // `Ignore` can share the brackets with other attributes, as in `[Test, Ignore("flaky")]`.
    markers: [["skipped", /\[\s*(?:Fact|Theory)\s*\([^)\]]*\bSkip\s*=|(?:^|\])\s*\[(?:[^\]]*[\s,])?Ignore\b/]]
  },
  {
    // XCTest and Swift Testing.
    files: /\.swift$/,
    markers: [["skipped", /\bthrow\s+XCTSkip\s*\(|\bXCTSkip(?:If|Unless)\s*\(|@Test\s*\([^)]{0,500}\.disabled\b/]]
  },
  {
    // PHPUnit and Pest.
    files: /\.php$/,
    markers: [
      ["focused", /->only\s*\(\s*\)/],
      // Pest chains `->skip()` on a test call; Laravel's query and collection `skip(10)` do not count.
      [
        "skipped",
        /\$this->markTest(?:Skipped|Incomplete)\s*\(|\}\)\s*->skip\s*\(|\b(?:it|test|describe)\s*\([^;]{0,2000}->skip\s*\(|^\s*->skip\s*\(\s*(?:\)|["'])/
      ]
    ]
  }
];
var skippedTestsRule = {
  id: "skipped-tests",
  description: "Flags tests that a pull request focuses or skips.",
  run({ files, config: config2 }) {
    if (!config2.rules.skippedTests.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.filter((file) => file.patch !== void 0).flatMap((file) => {
      const isTestFile = testGlobs.some((glob) => minimatch(file.path, glob));
      const markers = languages9.filter((language) => language.files.test(file.path) && (isTestFile || language.anyFile)).flatMap((language) => language.markers);
      const found = matchAddedLines(file.patch ?? "", markers).map(({ line, label }) => ({
        line,
        marker: label
      }));
      if (found.length === 0) {
        return [];
      }
      const focused = found.filter((match2) => match2.marker === "focused").map((match2) => match2.line);
      const skipped = found.filter((match2) => match2.marker === "skipped").map((match2) => match2.line);
      return [
        {
          ruleId: "skipped-tests",
          title: focused.length > 0 ? "Focused test added" : "Skipped test added",
          severity: "warning",
          file: file.path,
          line: Math.min(...found.map((match2) => match2.line)),
          lines: found.map((match2) => match2.line),
          message: [
            focused.length > 0 ? describeFocused(focused) : "",
            skipped.length > 0 ? describeSkipped(skipped) : ""
          ].filter(Boolean).join(" "),
          recommendation: "Remove focus markers before merging. If a test is skipped on purpose, explain why and link the issue that tracks re-enabling it."
        }
      ];
    });
  }
};
function describeFocused(lines) {
  const { text, plural } = describeLines(lines);
  return `${text} ${plural ? "focus tests" : "focuses a test"}, so the runner skips the other tests in scope.`;
}
function describeSkipped(lines) {
  const { text, plural } = describeLines(lines);
  return plural ? `${text} skip tests, so they can stop running without failing.` : `${text} skips a test, so it can stop running without failing.`;
}

// src/rules/sql-injection.ts
var sqlCall = /(?:^|[^\w$])(execute|executemany|executescript|query|raw|executeQuery|executeUpdate|addBatch|createQuery|createNativeQuery|prepareStatement|Query|QueryRow|QueryContext|QueryRowContext|Exec|ExecContext|FromSqlRaw|ExecuteSqlRaw|SqlCommand|find_by_sql|select_all|select_one|select_value|where|order|having|joins|mysqli_query|pg_query|read_sql|read_sql_query|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(/;
var sqlVariable = /\b\w*(?:sql|query|stmt|statement)\w*\s*(?::\s*[\w<>[\]]+\s*)?=(?!=)/i;
var fragmentCall = /^(?:where|order|having|joins|find_by_sql|select_all|select_one|select_value)$/;
var sqlKeyword = /\bselect\s.{1,500}?\bfrom\b|\binsert\s+into\b|\bupdate\s+[\w."`[\]]+\s+set\b|\bdelete\s+from\b|\bwhere\s+[\w."`[\]]+\s*(?:[=<>!]|like\b|in\b|is\b)|\b(?:order|group)\s+by\b|\bvalues\s*\(/i;
var builtString = [
  { pattern: /(?:^|[(\s,])(?:[rR]?[fF]|[fF][rR])["']/ },
  // Python f-string, also inside text(...)
  { pattern: /["']\s*%\s*[\w(]/, operator: true },
  // Python "... %s" % value
  { pattern: /["']\.format\(/, operator: true },
  // Python and C# .format()
  { pattern: /`[^`]*\$\{/ },
  // JavaScript template literal
  { pattern: /["'`]\s*\+\s*[\w$(]|[\w)\]]\s*\+\s*["'`]/, operator: true },
  // concatenation
  { pattern: /\b(?:fmt\.Sprintf|String\.format|sprintf)\s*\(/ },
  // Go, Java, PHP
  { pattern: /"[^"]*#\{/ }
  // Ruby interpolation
];
var quotedText2 = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
var quotedValue = /^\s*(?:(?:[\w$]+\.)*(?:quote|escape|sanitize_sql)[\w$]*\s*\([^]*\)|(?:quoted|escaped)[\w$]*|(?:[\w$]+\.)*[A-Z][A-Z0-9_]*)\s*$/;
var templateValue = /\$\{((?:[^{}]|\{[^{}]*\})*)\}/g;
var rubyValue = /#\{((?:[^{}]|\{[^{}]*\})*)\}/g;
var languageStrings = [
  [/\.php$/i, /"[^"]*\$[a-zA-Z_]|"\s*\.\s*\$|\$\w+\s*\.\s*"/],
  [/\.cs$/i, /\$@?"[^"]*\{/]
];
var commentLine40 = /^\s*(?:#|\/\/|\/\*|\*|--)/;
var documentation30 = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
var sqlInjectionRule = {
  id: "sql-injection",
  description: "Flags SQL built by inserting values into the query text instead of passing them as parameters.",
  run({ files, config: config2 }) {
    if (!config2.rules.sqlInjection.enabled) {
      return [];
    }
    const testGlobs = config2.rules.missingTests.testGlobs;
    return files.flatMap((file) => {
      if (file.patch === void 0 || documentation30.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const patterns3 = [...builtString, ...languageStrings.filter(([files2]) => files2.test(file.path)).map(([, pattern]) => ({ pattern }))];
      const lines = findBuiltSql(file.patch, patterns3);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "sql-injection",
          title: "SQL built from values",
          severity: "warning",
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "build" : "builds"} SQL from values inserted into the query text, which allows SQL injection unless every value is escaped.`,
          recommendation: "Pass values as query parameters (?, $1, %s with a separate argument, or named parameters) and keep the SQL text constant. For identifiers such as column names, choose from a fixed list."
        }
      ];
    });
  }
};
function findBuiltSql(patch, patterns3) {
  const found = [];
  let pendingCall;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      pendingCall = void 0;
    }
    if (commentLine40.test(content)) {
      continue;
    }
    const call = sqlCall.exec(content) ?? sqlVariable.exec(content);
    const target = call ? { name: call[1] ?? "", argument: content.slice(call.index + call[0].length) } : void 0;
    const checked = target ?? (pendingCall === void 0 ? void 0 : { name: pendingCall, argument: content });
    pendingCall = target !== void 0 && target.argument.trim() === "" ? target.name : void 0;
    if (added && checked !== void 0 && checked.argument.trim() !== "" && builds(checked.argument, patterns3) && (sqlKeyword.test(checked.argument) || fragmentCall.test(checked.name) && /^\s*\(?\s*"[^"]*#\{/.test(checked.argument))) {
      found.push(line);
    }
  }
  return found;
}
function builds(argument, patterns3) {
  const masked = argument.replace(quotedText2, (text) => `${text[0]}${"x".repeat(text.length - 2)}${text[0]}`);
  const matched = patterns3.filter(({ pattern, operator }) => pattern.test(operator ? masked : argument));
  if (matched.length === 0) {
    return false;
  }
  const readable = [builtString[1], builtString[3], builtString[4], builtString[6]].map((entry) => entry?.pattern);
  if (!matched.every(({ pattern }) => readable.includes(pattern))) {
    return true;
  }
  const values = [...argument.matchAll(templateValue), ...argument.matchAll(rubyValue)].map((match2) => match2[1] ?? "");
  const percent = /["']\s*%\s*/.exec(masked);
  if (percent !== null) {
    values.push(...percentOperands(argument.slice(percent.index + percent[0].length)));
  }
  if (builtString[4]?.pattern.test(masked)) {
    values.push(...concatenated(argument, masked));
  }
  return !(values.length > 0 && values.every((value) => quotedValue.test(value)));
}
function percentOperands(text) {
  const items = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      break;
    }
    current += char;
  }
  const operand = current.trim();
  const tuple = /^\((.*)\)$/s.exec(operand)?.[1];
  if (tuple === void 0) {
    items.push(operand);
    return items;
  }
  depth = 0;
  current = "";
  for (const char of tuple) {
    if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current);
  return items.filter((item) => item.trim() !== "");
}
function concatenated(argument, masked) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= masked.length; index += 1) {
    const char = masked[index] ?? "+";
    if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        parts.push(argument.slice(start, index));
        start = masked.length;
        break;
      }
      depth -= 1;
    } else if ((char === "+" || char === ";" || char === ",") && depth === 0) {
      parts.push(argument.slice(start, index));
      start = index + 1;
      if (char !== "+") {
        break;
      }
    }
  }
  return parts.map((part) => part.trim()).filter((part) => part !== "" && !/^(["'`]).*\1$/s.test(part));
}

// src/rules/index.ts
var defaultRules = [
  incompleteReviewRule,
  secretInDiffRule,
  credentialFileRule,
  hardcodedJwtSecretRule,
  secretLoggingRule,
  urlCredentialsRule,
  disabledSecurityCheckRule,
  hiddenUnicodeRule,
  largeDiffRule,
  missingTestsRule,
  skippedTestsRule,
  blanketSuppressionRule,
  riskyApiRule,
  unescapedHtmlRule,
  timingUnsafeComparisonRule,
  postMessageOriginRule,
  nosqlInjectionRule,
  templateInjectionRule,
  prototypePollutionRule,
  ldapXpathInjectionRule,
  uploadFilenameRule,
  reflectedXssRule,
  logInjectionRule,
  staticIvRule,
  plaintextPasswordRule,
  adminRouteAuthRule,
  zipSlipRule,
  regexInjectionRule,
  electronSecurityRule,
  unsafeReflectionRule,
  commandInjectionRule,
  weakPasswordHashingRule,
  hardcodedSessionSecretRule,
  jwtWithoutExpiryRule,
  sqlInjectionRule,
  insecureWebConfigRule,
  weakCryptoRule,
  untrustedInputRule,
  xmlExternalEntitiesRule,
  massAssignmentRule,
  redosRule,
  remoteScriptRule,
  workflowRiskRule,
  unpinnedActionRule,
  destructiveMigrationRule,
  privilegedContainerRule,
  dockerfileRiskRule,
  publicExposureRule,
  insecureInfrastructureRule,
  kubernetesRbacRule,
  filePermissionsRule,
  sensitiveFilesRule,
  configChangeRule,
  reviewControlChangeRule,
  lockfileSourceRule,
  lookalikeDependencyRule,
  riskyDependencyVersionRule,
  staleLockfileRule,
  dependencyRiskRule,
  oversizedPatchRule
];

// src/analysis/severity.ts
var weights = {
  info: 1,
  warning: 2,
  high: 3
};
function compareSeverity(left, right) {
  return weights[right] - weights[left];
}
function isAtLeast(severity, minimum2) {
  return weights[severity] >= weights[minimum2];
}

// src/analysis/suppressions.ts
var marker = /prism-review-ignore\s+([\w-]+(?:\s*,\s*[\w-]+)*)\s*(?:--|:)(.*)$/;
var closer = /(?:\*\/|-->|%>|#>)\s*$/;
var maxReasonLength = 200;
var standalone = /^\s*(?:#|\/\/|\/\*+|--|<!--|;|%|<%#|\{\/\*|'|REM\b)?\s*prism-review-ignore\b/i;
function applySuppressions(files, findings, protectedRules) {
  const markers = findMarkers2(files);
  const kept = [];
  const suppressed = [];
  for (const finding2 of findings) {
    const reason = protectedRules.has(finding2.ruleId) ? void 0 : reasonFor(finding2, markers);
    if (reason === void 0) {
      kept.push(finding2);
    } else {
      suppressed.push({ ...finding2, suppressionReason: reason });
    }
  }
  return { kept, suppressed };
}
function reasonFor(finding2, markers) {
  const lines = finding2.lines ?? (finding2.line === void 0 ? [] : [finding2.line]);
  const fileMarkers = finding2.file === void 0 ? void 0 : markers.get(finding2.file);
  if (lines.length === 0 || fileMarkers === void 0) {
    return void 0;
  }
  const reasons = lines.map((line) => fileMarkers.get(line)?.get(finding2.ruleId));
  return reasons.every((reason) => reason !== void 0) ? reasons[0] : void 0;
}
function findMarkers2(files) {
  const markers = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (file.patch === void 0 || !file.patch.includes("prism-review-ignore")) {
      continue;
    }
    const byLine = /* @__PURE__ */ new Map();
    for (const { line, content } of patchLines(file.patch)) {
      const match2 = marker.exec(content);
      const reason = (match2?.[2] ?? "").trim().replace(closer, "").trim().slice(0, maxReasonLength);
      if (match2 === null || !/\w/.test(reason)) {
        continue;
      }
      for (const target of standalone.test(content) ? [line, line + 1] : [line]) {
        const rules = byLine.get(target) ?? /* @__PURE__ */ new Map();
        for (const ruleId of (match2[1] ?? "").split(",").map((id) => id.trim())) {
          rules.set(ruleId, reason);
        }
        byLine.set(target, rules);
      }
    }
    markers.set(file.path, byLine);
  }
  return markers;
}

// src/analysis/analyze-pull-request.ts
function analyzePullRequest(files, config2, options = {}) {
  const {
    rules = defaultRules,
    configPath = defaultConfigPath,
    extendedConfigPaths = [],
    expectedFileCount,
    isGenerated = () => false,
    existingLockfiles
  } = options;
  const changedPaths = new Set(files.flatMap((file) => [file.path, ...file.previousPath === void 0 ? [] : [file.previousPath]]));
  const pathOverrides = config2.overrides.map((override) => ({
    matchers: override.paths.map((glob) => new Minimatch(glob, { dot: true })),
    severity: override.severity
  }));
  const { reviewed: reviewed3, ignoredByConfig, generated } = partitionFiles(files, config2, isGenerated);
  const all = rules.flatMap(
    (rule) => rule.run({
      files: rule.seesIgnoredFiles ? files : reviewed3,
      config: config2,
      configPath,
      extendedConfigPaths,
      expectedFileCount,
      changedPaths,
      ...existingLockfiles === void 0 ? {} : { existingLockfiles }
    })
  ).flatMap((finding2) => applySeverityOverride(finding2, config2, pathOverrides)).sort((left, right) => compareSeverity(left.severity, right.severity));
  const protectedRules = new Set(rules.filter((rule) => rule.seesIgnoredFiles).map((rule) => rule.id));
  const { kept: findings, suppressed } = applySuppressions(files, all, protectedRules);
  return {
    summary: buildSummary(reviewed3.length, ignoredByConfig.size, generated.size, findings, suppressed.length),
    riskLevel: calculateRiskLevel(reviewed3, findings, config2),
    findings,
    suppressed,
    ...nonEmpty("dependencyChanges", dependencyChanges(reviewed3))
  };
}
function partitionFiles(files, config2, isGenerated = () => false) {
  const ignored = config2.ignorePaths.map((glob) => new Minimatch(glob, { dot: true }));
  const isIgnored = (path2) => ignored.some((matcher) => matcher.match(path2));
  const leftOut = (file, excluded) => excluded(file.path) && (file.previousPath === void 0 || excluded(file.previousPath));
  const ignoredByConfig = new Set(files.filter((file) => leftOut(file, isIgnored)));
  const generated = new Set(
    files.filter((file) => !ignoredByConfig.has(file) && leftOut(file, (path2) => isIgnored(path2) || isGenerated(path2)))
  );
  const reviewed3 = files.filter((file) => !ignoredByConfig.has(file) && !generated.has(file));
  return { reviewed: reviewed3, ignoredByConfig, generated };
}
function nonEmpty(key, values) {
  return values.length > 0 ? { [key]: values } : {};
}
function applySeverityOverride(finding2, config2, pathOverrides) {
  let override = config2.severity[finding2.ruleId];
  const file = finding2.file;
  if (file !== void 0) {
    for (const entry of pathOverrides) {
      if (entry.severity[finding2.ruleId] !== void 0 && entry.matchers.some((matcher) => matcher.match(file))) {
        override = entry.severity[finding2.ruleId];
      }
    }
  }
  if (override === void 0) {
    return [finding2];
  }
  return override === "off" ? [] : [{ ...finding2, severity: override }];
}
function buildSummary(reviewedCount, ignoredCount, generatedCount, findings, suppressedCount) {
  const ignored = ignoredCount > 0 ? `, ${ignoredCount} more ignored by ignorePaths` : "";
  const generated = generatedCount > 0 ? `, ${generatedCount} more generated or vendored` : "";
  const reviewed3 = `Reviewed ${reviewedCount} changed file(s)${ignored}${generated}.`;
  const found = findings.length === 0 ? "No configured risk signals were detected." : `Found ${countBySeverity(findings, "high")} high-risk and ${countBySeverity(findings, "warning")} warning-level signal(s).`;
  const suppressed = suppressedCount > 0 ? ` ${suppressedCount} finding(s) were suppressed inline.` : "";
  return `${reviewed3} ${found}${suppressed}`;
}
function calculateRiskLevel(files, findings, config2) {
  if (findings.some((finding2) => finding2.severity === "high")) {
    return "high";
  }
  const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
  const largeDiff = config2.risk.largeDiff;
  const sizeCounts = config2.severity["large-diff"] !== "off";
  if (countBySeverity(findings, "warning") >= 2 || sizeCounts && (files.length > largeDiff.maxFiles || totalChangedLines > largeDiff.maxChangedLines)) {
    return "medium";
  }
  return "low";
}

// src/analysis/git-attributes.ts
var gitAttributesPath = ".gitattributes";
var defaultVendored = /(?:^|\/)(?:vendor|vendors|third[-_]?party|3rd[-_]?party|node_modules|bower_components|dist)\/|[.-]min\.(?:js|css)$/i;
var maxRules2 = 5e3;
var maxPatternLength3 = 500;
function parseGitAttributes(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || /^(?:#|\[attr\]|")/.test(line) || rules.length >= maxRules2) {
      continue;
    }
    const [pattern = "", ...attributes] = line.split(/\s+/);
    if (pattern.length > maxPatternLength3 || pattern.startsWith("!") || pattern.endsWith("/")) {
      continue;
    }
    const rule = { matcher: new Minimatch(patternGlob(pattern), { dot: true }) };
    for (const attribute of attributes) {
      const state = attributeState(attribute);
      if (state?.name === "linguist-generated") {
        rule.generated = state.set;
      } else if (state?.name === "linguist-vendored") {
        rule.vendored = state.set;
      }
    }
    if (rule.generated !== void 0 || rule.vendored !== void 0) {
      rules.push(rule);
    }
  }
  return {
    isGenerated(path2) {
      let generated = false;
      let vendored;
      for (const rule of rules) {
        if (rule.matcher.match(path2)) {
          generated = rule.generated ?? generated;
          vendored = rule.vendored ?? vendored;
        }
      }
      return generated || (vendored ?? defaultVendored.test(path2));
    }
  };
}
var defaultGeneratedFiles = parseGitAttributes("");
function patternGlob(pattern) {
  return pattern.includes("/") ? pattern.replace(/^\/+/, "") : `**/${pattern}`;
}
function attributeState(attribute) {
  const match2 = /^([-!]?)([\w.-]+)(?:=(.*))?$/.exec(attribute);
  if (match2 === null) {
    return void 0;
  }
  const [, prefix = "", name = "", value] = match2;
  return { name, set: prefix === "" && value !== "false" && value !== "0" };
}

// src/github/client.ts
var GitHubApiError = class extends Error {
  constructor(status, details) {
    super(`GitHub API request failed: ${status} ${details}`);
    this.status = status;
    this.name = "GitHubApiError";
  }
  status;
};
var defaultGitHubApiUrl = "https://api.github.com";
var requestTimeoutMs = 15e3;
var pageSize = 100;
var maxPages = pullRequestFileLimit / pageSize;
var maxErrorDetailLength = 300;
function createGitHubClient(token2, apiUrl = defaultGitHubApiUrl) {
  async function request(path2, options = {}) {
    const response = await fetch(`${apiUrl}${path2}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        // Without a token, as in the CLI, requests are anonymous and only read public repositories.
        ...token2 === "" ? {} : { Authorization: `Bearer ${token2}` },
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        truncate(await response.text(), maxErrorDetailLength)
      );
    }
    if (response.status === 204) {
      return void 0;
    }
    return await response.json();
  }
  async function paginate(path2) {
    const items = [];
    const separator = path2.includes("?") ? "&" : "?";
    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await request(`${path2}${separator}per_page=${pageSize}&page=${page}`);
      items.push(...batch);
      if (batch.length < pageSize) {
        break;
      }
    }
    return items;
  }
  return { request, paginate };
}
function resolveGitHubApiUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return defaultGitHubApiUrl;
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

// src/github/load-lockfiles.ts
var maxDirectories = 20;
async function findLockfiles(files, list2) {
  const directories = /* @__PURE__ */ new Set();
  const names2 = /* @__PURE__ */ new Set();
  for (const file of files) {
    const lockfiles = lockfilesFor(file.path);
    if (lockfiles.length > 0 && dependencyChanges([file]).length > 0) {
      lockfiles.forEach((name) => names2.add(name));
      lockfileDirectories(file.path).forEach((directory) => directories.add(directory));
    }
  }
  const existing = /* @__PURE__ */ new Set();
  for (const directory of [...directories].slice(0, maxDirectories)) {
    for (const name of await list2(directory)) {
      if (names2.has(name)) {
        existing.add(joinPath(directory, name));
      }
    }
  }
  return existing;
}

// src/analysis/check-outcome.ts
function failingFindings(result, failOn) {
  if (failOn === "never") {
    return [];
  }
  return result.findings.filter((finding2) => isAtLeast(finding2.severity, failOn));
}
function describeFailure(failing, failOn, setting = "check.failOn") {
  const severities = failOn === "high" ? "high-risk" : "warning or high-risk";
  return `Prism Review found ${failing.length} ${severities} finding(s), and ${setting} is "${failOn}".`;
}

// src/config/extends.ts
var import_yaml2 = __toESM(require_dist(), 1);

// src/config/load-config.ts
var import_yaml = __toESM(require_dist(), 1);
function parseConfigObject(parsed, source) {
  const result = prismConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue2) => `${issue2.path.join(".") || "(root)"}: ${issue2.message}`
    );
    throw invalidConfig(source, issues.join("; "));
  }
  return result.data;
}
function invalidConfig(source, details) {
  return new Error(`Invalid Prism Review configuration in ${source}: ${details}`);
}

// src/config/extends.ts
var maxDepth = 5;
var remote = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([\w.-]{1,100})\/([^@\s]{1,500})@([\w./-]{1,250})$/;
var localPath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^@\s\\]{1,500}$/;
function parseExtends(value, source) {
  const trimmed = value.trim();
  const match2 = remote.exec(trimmed);
  if (match2) {
    const [, owner = "", repo = "", path2 = "", ref = ""] = match2;
    return { kind: "remote", owner, repo, path: path2, ref };
  }
  if (localPath.test(trimmed)) {
    return { kind: "local", path: trimmed.replace(/^\.\//, "") };
  }
  throw new Error(
    `Invalid Prism Review configuration in ${source}: extends must be a path in this repository, such as .github/prism-review-base.yml, or owner/repo/path@ref, such as acme/policies/prism-review.yml@v2.`
  );
}
async function resolveConfig(raw, source, read, path2) {
  const extendedPaths = [];
  const chain = path2 === void 0 ? [] : [targetKey({ kind: "local", path: path2.replace(/^\.\//, "") })];
  const merged = await resolveObject(raw, source, read, chain, extendedPaths);
  return { config: parseConfigObject(merged, source), extendedPaths };
}
async function resolveObject(raw, source, read, chain, extendedPaths) {
  const object2 = parseYaml(raw, source);
  const { extends: target, ...settings4 } = object2;
  if (target === void 0) {
    return settings4;
  }
  if (typeof target !== "string") {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends must be a string.`);
  }
  if (chain.length > maxDepth) {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends goes more than ${maxDepth} files deep.`);
  }
  const parsed = parseExtends(target, source);
  const key = targetKey(parsed);
  if (chain.includes(key)) {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends ${target}, which extends it back.`);
  }
  const parent = await read(parsed);
  if (parent === void 0) {
    throw new Error(
      `Invalid Prism Review configuration in ${source}: extends ${target}, which was not found${parsed.kind === "remote" ? " or the token cannot read it" : ""}.`
    );
  }
  if (parsed.kind === "local") {
    extendedPaths.push(parsed.path);
  }
  const base = await resolveObject(parent.raw, parent.source, read, [...chain, key], extendedPaths);
  return merge2(base, settings4);
}
function parseYaml(raw, source) {
  let parsed;
  try {
    parsed = (0, import_yaml2.parse)(raw) ?? {};
  } catch (error2) {
    const message = error2 instanceof Error ? error2.message : String(error2);
    throw new Error(`Invalid Prism Review configuration in ${source}: ${message}`);
  }
  if (!isObject2(parsed)) {
    throw new Error(`Invalid Prism Review configuration in ${source}: (root): Expected a mapping.`);
  }
  return parsed;
}
function merge2(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isObject2(current) && isObject2(value) ? merge2(current, value) : value;
  }
  return merged;
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function targetKey(target) {
  return target.kind === "local" ? `local:${target.path}` : `${target.owner}/${target.repo}/${target.path}@${target.ref}`;
}

// src/github/fetch-repository-file.ts
async function fetchRepositoryFile(client, owner, repo, path2, ref) {
  const encodedPath = path2.split("/").map(encodeURIComponent).join("/");
  let content;
  try {
    content = await client.request(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
    );
  } catch (error2) {
    if (error2 instanceof GitHubApiError && error2.status === 404) {
      return void 0;
    }
    throw error2;
  }
  if (Array.isArray(content) || content.type !== "file") {
    throw new Error(`${path2} is not a file at ${ref}.`);
  }
  if (content.encoding !== "base64" || content.content === void 0) {
    throw new Error(`${path2} at ${ref} is too large to read through the contents API.`);
  }
  return Buffer.from(content.content, "base64").toString("utf8");
}

// src/rules/areas.ts
var areas = [
  { id: "secrets", title: "Secrets" },
  { id: "supply-chain", title: "Supply Chain" },
  { id: "infrastructure", title: "Infrastructure" },
  { id: "code", title: "Code" },
  { id: "tests", title: "Tests" },
  { id: "review-scope", title: "Review Scope" },
  { id: "other", title: "Other" }
];
var ruleAreas = {
  "secret-in-diff": "secrets",
  "credential-file": "secrets",
  "hardcoded-jwt-secret": "secrets",
  "hardcoded-session-secret": "secrets",
  "secret-logging": "secrets",
  "url-credentials": "secrets",
  "dependency-risk": "supply-chain",
  "lockfile-source": "supply-chain",
  "lookalike-dependency": "supply-chain",
  "risky-dependency-version": "supply-chain",
  "stale-lockfile": "supply-chain",
  "unpinned-action": "supply-chain",
  "workflow-risk": "supply-chain",
  "remote-script": "supply-chain",
  "privileged-container": "infrastructure",
  "dockerfile-risk": "infrastructure",
  "public-exposure": "infrastructure",
  "insecure-infrastructure": "infrastructure",
  "kubernetes-rbac": "infrastructure",
  "file-permissions": "infrastructure",
  "destructive-migration": "infrastructure",
  "sql-injection": "code",
  "insecure-web-config": "code",
  "weak-crypto": "code",
  "xml-external-entities": "code",
  "mass-assignment": "code",
  redos: "code",
  "untrusted-input": "code",
  "risky-api": "code",
  "unescaped-html": "code",
  "timing-unsafe-comparison": "code",
  "postmessage-origin": "code",
  "nosql-injection": "code",
  "template-injection": "code",
  "prototype-pollution": "code",
  "ldap-xpath-injection": "code",
  "upload-filename": "code",
  "reflected-xss": "code",
  "log-injection": "code",
  "static-iv": "code",
  "plaintext-password": "code",
  "admin-route-auth": "code",
  "zip-slip": "code",
  "regex-injection": "code",
  "electron-security": "code",
  "unsafe-reflection": "code",
  "command-injection": "code",
  "weak-password-hashing": "code",
  "jwt-without-expiry": "code",
  "disabled-security-check": "code",
  "hidden-unicode": "code",
  "blanket-suppression": "code",
  "missing-tests": "tests",
  "skipped-tests": "tests",
  "incomplete-review": "review-scope",
  "large-diff": "review-scope",
  "oversized-patch": "review-scope",
  "sensitive-files": "review-scope",
  "config-change": "review-scope",
  "review-control-change": "review-scope"
};
function areaOf(ruleId) {
  return Object.hasOwn(ruleAreas, ruleId) ? ruleAreas[ruleId] ?? "other" : "other";
}

// src/reporting/render-json.ts
function renderJson(result) {
  const suppressed = result.suppressed ?? [];
  return JSON.stringify(
    {
      riskLevel: result.riskLevel,
      summary: result.summary,
      counts: {
        high: countBySeverity(result.findings, "high"),
        warning: countBySeverity(result.findings, "warning"),
        info: countBySeverity(result.findings, "info"),
        suppressed: suppressed.length
      },
      findings: result.findings.map(plainFinding),
      suppressed: suppressed.map((finding2) => ({ ...plainFinding(finding2), reason: finding2.suppressionReason })),
      dependencyChanges: result.dependencyChanges ?? []
    },
    null,
    2
  );
}
function plainFinding(finding2) {
  return {
    ruleId: finding2.ruleId,
    area: areaOf(finding2.ruleId),
    severity: finding2.severity,
    title: finding2.title,
    message: finding2.message,
    ...finding2.recommendation === void 0 ? {} : { recommendation: finding2.recommendation },
    ...finding2.file === void 0 ? {} : { file: finding2.file },
    ...finding2.line === void 0 ? {} : { line: finding2.line },
    ...finding2.lines === void 0 ? {} : { lines: finding2.lines }
  };
}

// src/reporting/checklist.ts
var ruleQuestions = {
  "secret-in-diff": "Has each credential added here been revoked and replaced? Removing it in a later commit leaves it in the Git history.",
  "credential-file": "Do the committed credential files belong in the repository, or in a secret store?",
  "hardcoded-jwt-secret": "Is each JWT key written in the code replaced by one from a secret store, and the committed key retired?",
  "secret-logging": "Do the new log lines write only that a secret was present, never its value?",
  "url-credentials": "Is each password found in a URL changed, and the URL now built from a secret at run time?",
  "dependency-risk": "Are the new or updated dependencies necessary and trusted?",
  "lockfile-source": "Do the packages from other sources come from places the team trusts?",
  "lookalike-dependency": "Is each flagged dependency the package that was meant, and not a lookalike of a popular one?",
  "stale-lockfile": "Was the lockfile regenerated with the manifest, so the versions installed are the ones reviewed?",
  "risky-dependency-version": "Is each older or open-ended dependency version intended, and does a lockfile pin what is actually installed?",
  "unpinned-action": "Can the third-party actions be pinned to a full commit SHA?",
  "workflow-risk": "Can someone who opens a pull request or an issue change what the workflows run, or reach their secrets?",
  "remote-script": "Is each downloaded script checked against a known checksum or signature before it runs?",
  "privileged-container": "Does each container need the privileges it is given?",
  "dockerfile-risk": "Is each image pinned, run as a non-root user, and built without secrets in ENV or ARG?",
  "public-exposure": "Is everything opened to the internet meant to be public?",
  "file-permissions": "Does any file need to be writable by every user, or run with its owner's rights?",
  "kubernetes-rbac": "Does each service account need the roles it is bound to, and nothing cluster-wide?",
  "insecure-infrastructure": "Does each role need every action it is granted, and is turning off encryption, TLS 1.2, audit logs, or IMDSv2 intended?",
  "destructive-migration": "Is the affected data backed up, and can the migration be rolled back while the previous release is still running?",
  "sql-injection": "Is every value in the flagged queries passed as a parameter?",
  "untrusted-input": "Is each redirect target, outgoing URL, and file path from the request checked against what is allowed?",
  "weak-crypto": "Are secrets hashed with a password hash, encrypted with an authenticated cipher, and made with a cryptographic random generator?",
  "xml-external-entities": "Does every XML parser that turns on DTDs or external entities read only trusted documents?",
  "mass-assignment": "Does each form, serializer, or model write accept only the fields a user may change?",
  redos: "Can a user send the text these regular expressions read, and is its length limited?",
  "insecure-web-config": "Which origins may send credentials, and do the cookies and debug settings match production?",
  "risky-api": "Can input from users, files, or the network reach the flagged calls?",
  "unescaped-html": "Is every value written into the page without escaping either fixed text or sanitized first?",
  "timing-unsafe-comparison": "Are signatures, tokens, and keys compared in constant time?",
  "postmessage-origin": "Does every cross-window message name its target origin, and every handler check `event.origin`?",
  "nosql-injection": "Is every request value cast to text, or matched with `$eq`, before it reaches a MongoDB filter?",
  "template-injection": "Are templates kept in files or fixed text, with request values passed only as variables?",
  "prototype-pollution": "Do merges and assignments by key skip `__proto__`, `constructor`, and `prototype`?",
  "ldap-xpath-injection": "Is every value in an LDAP filter or XPath expression escaped or bound as a variable?",
  "upload-filename": "Are uploads stored under names the server makes, with their type checked?",
  "reflected-xss": "Is every request value escaped before it is written into an HTML response?",
  "log-injection": "Are line breaks removed from request values before they go into log text?",
  "static-iv": "Does every encryption use a new random IV or nonce?",
  "plaintext-password": "Are passwords stored only as slow, salted hashes and checked with the library's verify function?",
  "admin-route-auth": "Does every new admin or internal route check who is calling and what role they have?",
  "zip-slip": "Is every archive entry checked to stay inside the destination before it is written?",
  "regex-injection": "Is every request value escaped before it goes into a regular expression?",
  "electron-security": "Do Electron windows keep Node.js out of web content, with context isolation, the sandbox, and web security on?",
  "unsafe-reflection": "Is every module, class, or method chosen by request input looked up in a fixed table or allowlist?",
  "command-injection": "Do commands run a fixed program, with request values passed as separate arguments and no shell?",
  "weak-password-hashing": "Do password hashes use a bcrypt cost of at least 10, enough PBKDF2 iterations, or Argon2id?",
  "hardcoded-session-secret": "Is the session signing key loaded from a secret store, and was any committed key replaced?",
  "jwt-without-expiry": "Does every token expire, with longer sessions kept by refresh tokens the server can revoke?",
  "disabled-security-check": "Is turning off each security check intended, and limited to where it is needed?",
  "hidden-unicode": "Do the lines with hidden characters do what they appear to do?",
  "blanket-suppression": "Can the blanket suppressions name the rules they skip?",
  "missing-tests": "Are tests covering the changed behavior?",
  "skipped-tests": "Will the focused or skipped tests be restored before merging?",
  "incomplete-review": "Who reviews the files that Prism Review could not see?",
  "large-diff": "Could this pull request be split into smaller ones?",
  "oversized-patch": "Has someone read the files too large for Prism Review to inspect?",
  "sensitive-files": "Are security-sensitive changes reviewed by the right owner?",
  "config-change": "Has someone who owns the review configuration approved the change to it?",
  "review-control-change": "Did the current owners of the affected paths approve the change to CODEOWNERS or to the files marked generated or vendored?"
};
var defaultQuestions = [
  "Are tests covering the changed behavior?",
  "Are security-sensitive changes reviewed by the right owner?",
  "Are deployment, migration, or rollback risks understood?",
  "Are new dependencies necessary and trusted?"
];
var maxQuestions = 8;
function checklistQuestions(findings, extra = []) {
  const areaIndex = (finding2) => areas.findIndex((area) => area.id === areaOf(finding2.ruleId));
  const ordered = [...findings].sort(
    (left, right) => compareSeverity(left.severity, right.severity) || areaIndex(left) - areaIndex(right)
  );
  const asked = /* @__PURE__ */ new Set();
  for (const finding2 of ordered) {
    const question = Object.hasOwn(ruleQuestions, finding2.ruleId) ? ruleQuestions[finding2.ruleId] : void 0;
    if (question !== void 0 && asked.size < maxQuestions) {
      asked.add(question);
    }
  }
  return [...asked.size > 0 ? asked : defaultQuestions, ...extra];
}

// src/reporting/rule-docs.ts
var docsUrl = "https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md";
var ruleSections = {
  "incomplete-review": "Rules Without Options",
  "secret-in-diff": "Secrets",
  "credential-file": "Credential Files",
  "hardcoded-jwt-secret": "Hardcoded JWT Secrets",
  "secret-logging": "Secret Logging",
  "url-credentials": "URL Credentials",
  "disabled-security-check": "Disabled Security Checks",
  "hidden-unicode": "Hidden Unicode",
  "large-diff": "Large Diff",
  "missing-tests": "Missing Tests",
  "skipped-tests": "Skipped Tests",
  "blanket-suppression": "Blanket Suppressions",
  "risky-api": "Risky APIs",
  "unescaped-html": "Unescaped HTML",
  "timing-unsafe-comparison": "Timing-Unsafe Comparison",
  "postmessage-origin": "postMessage Origin",
  "nosql-injection": "NoSQL Injection",
  "template-injection": "Template Injection",
  "prototype-pollution": "Prototype Pollution",
  "ldap-xpath-injection": "LDAP and XPath Injection",
  "upload-filename": "Upload File Names",
  "reflected-xss": "Reflected XSS",
  "log-injection": "Log Injection",
  "static-iv": "Static IVs",
  "plaintext-password": "Plaintext Passwords",
  "admin-route-auth": "Admin Route Access",
  "zip-slip": "Archive Extraction",
  "regex-injection": "Regular Expression Injection",
  "electron-security": "Electron Security",
  "unsafe-reflection": "Unsafe Reflection",
  "command-injection": "Command Injection",
  "weak-password-hashing": "Weak Password Hashing",
  "hardcoded-session-secret": "Hardcoded Session Secrets",
  "jwt-without-expiry": "JWT Expiry",
  "sql-injection": "SQL Injection",
  "insecure-web-config": "Insecure Web Configuration",
  "weak-crypto": "Weak Cryptography",
  "untrusted-input": "Untrusted Input",
  "xml-external-entities": "XML External Entities",
  "mass-assignment": "Mass Assignment",
  redos: "Regular Expression Denial of Service",
  "remote-script": "Remote Scripts",
  "workflow-risk": "Workflow Risk",
  "unpinned-action": "Unpinned Actions",
  "destructive-migration": "Destructive Migrations",
  "privileged-container": "Privileged Containers",
  "dockerfile-risk": "Dockerfile Risk",
  "public-exposure": "Public Exposure",
  "insecure-infrastructure": "Insecure Infrastructure",
  "kubernetes-rbac": "Kubernetes RBAC",
  "file-permissions": "File Permissions",
  "sensitive-files": "Sensitive Files",
  "config-change": "Rules Without Options",
  "review-control-change": "Review Control Changes",
  "lockfile-source": "Lockfile Sources",
  "lookalike-dependency": "Lookalike Dependencies",
  "risky-dependency-version": "Risky Dependency Versions",
  "stale-lockfile": "Stale Lockfiles",
  "dependency-risk": "Dependency Risk",
  "oversized-patch": "Rules Without Options"
};
function ruleDocsUrl(ruleId) {
  const section = Object.hasOwn(ruleSections, ruleId) ? ruleSections[ruleId] : void 0;
  return section === void 0 ? void 0 : `${docsUrl}#${headingAnchor(section)}`;
}
function headingAnchor(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

// src/reporting/review-state.ts
var import_node_crypto = require("node:crypto");
var STATE_MARKER = "prism-review-state";
var maxRecorded = 400;
var rulePattern = /^[a-z0-9-]{1,64}$/;
function fingerprint(finding2) {
  const hash = (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([finding2.file ?? "", finding2.title])).digest("hex");
  return `${finding2.ruleId}:${hash.slice(0, 12)}`;
}
function renderState(findings) {
  if (findings.length > maxRecorded) {
    return `<!-- ${STATE_MARKER} v1 incomplete -->`;
  }
  const byRule = /* @__PURE__ */ new Map();
  for (const finding2 of findings) {
    const [ruleId = "", hash = ""] = fingerprint(finding2).split(":");
    if (rulePattern.test(ruleId)) {
      byRule.set(ruleId, [...byRule.get(ruleId) ?? [], hash]);
    }
  }
  const entries = [...byRule].map(([ruleId, hashes]) => `${ruleId}:${hashes.join(",")}`);
  return `<!-- ${STATE_MARKER} v1${entries.map((entry) => ` ${entry}`).join("")} -->`;
}
function compareWithPrevious(findings, previous) {
  const remaining = new Map(previous);
  const fresh = /* @__PURE__ */ new Set();
  for (const finding2 of findings) {
    const key = fingerprint(finding2);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else {
      fresh.add(finding2);
    }
  }
  const gone = /* @__PURE__ */ new Map();
  for (const [key, count] of remaining) {
    if (count > 0) {
      const ruleId = key.split(":")[0] ?? "";
      gone.set(ruleId, (gone.get(ruleId) ?? 0) + count);
    }
  }
  return {
    isNew: (finding2) => fresh.has(finding2),
    newCount: fresh.size,
    noLongerReported: [...gone].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  };
}

// src/reporting/render-markdown.ts
var PRISM_COMMENT_MARKER = "<!-- prism-review-comment -->";
function renderMarkdown(result, options = { includeLowSeverity: false }) {
  const findings = options.includeLowSeverity ? result.findings : result.findings.filter((finding2) => finding2.severity !== "info");
  const suppressed = renderSuppressed(result.suppressed ?? []);
  const dependencies = options.dependencyChanges === false ? [] : renderDependencyChanges(result.dependencyChanges ?? []);
  const aiSummary = options.aiSummary === void 0 ? [] : renderAiSummary(options.aiSummary);
  const comparison = options.previous === void 0 ? void 0 : compareWithPrevious(findings, options.previous);
  const changes = comparison === void 0 ? [] : [renderChanges(comparison), ""];
  const state = options.recordState ? ["", renderState(findings)] : [];
  const owners = (finding2) => finding2.file === void 0 || options.ownersOf === void 0 ? [] : options.ownersOf(finding2.file);
  const checklist = [
    ...checklistQuestions(findings).map((question) => `- ${escapeText(question)}`),
    ...renderOwnersQuestion(findings.flatMap(owners)),
    ...(options.checklist ?? []).map((question) => `- ${escapeText(question)}`)
  ];
  const budget = maxFindingsLength - [...aiSummary, ...suppressed, ...dependencies, ...changes, ...state, ...checklist].join("\n").length;
  return [
    PRISM_COMMENT_MARKER,
    "",
    "## Prism Review",
    "",
    `Risk level: **${capitalize(result.riskLevel)}**`,
    "",
    "### Summary",
    "",
    result.summary,
    "",
    ...aiSummary,
    "### Findings",
    "",
    ...changes,
    findings.length === 0 ? "No warning or high-risk findings were detected." : renderFindings(
      findings,
      budget,
      (finding2) => renderFinding(finding2, comparison?.isNew(finding2) ?? false, owners(finding2))
    ),
    "",
    ...dependencies,
    ...suppressed,
    "### Suggested Review Checklist",
    "",
    ...checklist,
    ...state
  ].join("\n");
}
function renderAiSummary(summary) {
  const partial2 = summary.filesNotSent === 0 ? [] : [`${summary.filesNotSent} changed file(s) were sent by name only, over \`ai.maxInputCharacters\`, so this summary covers part of the change.`, ""];
  return [
    "### AI Summary",
    "",
    `> Advisory: written by ${codeSpan(summary.model)} from the redacted diff. It does not change the risk level, the findings, or the check, and can be wrong.`,
    "",
    advisoryText(summary.overview),
    "",
    ...summary.concerns.map(
      (entry) => `- ${entry.file === void 0 ? "" : `${codeSpan(entry.file)}: `}${advisoryText(entry.concern)}`
    ),
    ...summary.concerns.length > 0 ? [""] : [],
    ...partial2
  ];
}
var linkable = /@[\w-]{1,100}(?:\/[\w-]{1,100})?|(?:[\w.-]{1,100}\/[\w.-]{1,100})?#\d{1,10}\b|\bGH-\d{1,10}\b|\b(?:https?:\/\/|www\.)\S{1,2000}/gi;
function advisoryText(text) {
  let rendered2 = "";
  let last = 0;
  for (const match2 of text.matchAll(linkable)) {
    rendered2 += escapeText(showHiddenCharacters(text.slice(last, match2.index))) + codeSpan(match2[0]);
    last = match2.index + match2[0].length;
  }
  return rendered2 + escapeText(showHiddenCharacters(text.slice(last)));
}
function renderChanges({ newCount, noLongerReported }) {
  const resolved = noLongerReported.reduce((total, [, count]) => total + count, 0);
  if (newCount === 0 && resolved === 0) {
    return "No findings were added or resolved since the previous review.";
  }
  const rules = noLongerReported.map(([ruleId, count]) => `${codeSpan(ruleId)} (${count})`).join(", ");
  return `Since the previous review: ${newCount} new finding(s), ${resolved} no longer reported${resolved > 0 ? ` (${rules})` : ""}.`;
}
var maxFindingsLength = 55e3;
var groupingReserve = 1e3;
function renderFindings(findings, budget, render2) {
  const grouped = new Set(findings.map((finding2) => areaOf(finding2.ruleId))).size > 1;
  const shown2 = [];
  let length = 0;
  for (const finding2 of findings) {
    const block = render2(finding2);
    if (length + block.length > budget - (grouped ? groupingReserve : 0)) {
      break;
    }
    shown2.push({ finding: finding2, block });
    length += block.length + 2;
  }
  const rendered2 = grouped ? renderGroups(findings, shown2) : shown2.map(({ block }) => block);
  const hidden = findings.length - shown2.length;
  if (hidden > 0) {
    rendered2.push(
      `${hidden} more finding(s) are not shown here to keep the comment within GitHub's size limit. Enable annotations or run the CLI to see every finding.`
    );
  }
  return rendered2.join("\n\n");
}
function renderGroups(findings, shown2) {
  const groups = areas.map((area) => ({
    area,
    all: findings.filter((finding2) => areaOf(finding2.ruleId) === area.id),
    blocks: shown2.filter(({ finding: finding2 }) => areaOf(finding2.ruleId) === area.id).map(({ block }) => block)
  })).filter((group) => group.all.length > 0).sort((left, right) => compareSeverity(topSeverity(left.all), topSeverity(right.all)));
  const overview = groups.map(({ area, all }) => `${area.title} (${all.length})`).join(", ");
  return [
    `${findings.length} findings in ${groups.length} areas: ${overview}.`,
    ...groups.filter((group) => group.blocks.length > 0).map(({ area, all, blocks }) => {
      const count = blocks.length === all.length ? `${all.length}` : `${blocks.length} of ${all.length} shown`;
      return [`### ${area.title} (${count})`, ...blocks].join("\n\n");
    })
  ];
}
function topSeverity(findings) {
  return findings.map((finding2) => finding2.severity).sort(compareSeverity)[0] ?? "info";
}
var maxDependencyRows = 30;
var maxDependencyLength = 8e3;
function renderDependencyChanges(changes) {
  if (changes.length === 0) {
    return [];
  }
  const cell = (value) => codeSpan(value).replace(/\|/g, "\\|");
  const version3 = (value) => value === void 0 || value === "" ? "" : ` ${cell(value)}`;
  const rows = [];
  let length = 0;
  for (const change of changes.slice(0, maxDependencyRows)) {
    const what = change.from === void 0 ? `added${version3(change.to)}` : change.to === void 0 ? `removed${version3(change.from)}` : `${cell(change.from || unversioned(change))} to ${cell(change.to || unversioned(change))}`;
    const row = `| ${cell(change.file)} | ${cell(change.name)} | ${what} |`;
    if (length + row.length > maxDependencyLength) {
      break;
    }
    rows.push(row);
    length += row.length + 1;
  }
  const hidden = changes.length - rows.length;
  const table = rows.length === 0 ? [] : ["| File | Package | Change |", "| --- | --- | --- |", ...rows];
  const more = hidden === 0 ? [] : [`${hidden} ${rows.length === 0 ? "" : "more "}dependency change(s) are not shown.`];
  return ["### Dependency Changes", "", ...table, ...table.length > 0 && more.length > 0 ? [""] : [], ...more, ""];
}
function unversioned(change) {
  return change.ecosystem === "Maven" ? "managed" : "any";
}
var maxSuppressedShown = 50;
var maxSuppressedLength = 1e4;
function renderSuppressed(suppressed) {
  if (suppressed.length === 0) {
    return [];
  }
  const lines = [];
  let length = 0;
  for (const finding2 of suppressed.slice(0, maxSuppressedShown)) {
    const where = finding2.file === void 0 ? "" : ` on line ${finding2.line ?? "?"} of ${codeSpan(finding2.file)}`;
    const line = `- ${codeSpan(finding2.ruleId)}${where}: ${escapeText(finding2.suppressionReason)}`;
    if (length + line.length > maxSuppressedLength) {
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  if (suppressed.length > lines.length) {
    lines.push(`- ${suppressed.length - lines.length} more suppressed finding(s) are not shown.`);
  }
  return ["### Suppressed Inline", "", ...lines, ""];
}
function renderFinding(finding2, isNew, owners) {
  const sections = [
    `#### ${capitalize(finding2.severity)} - ${escapeText(finding2.title)}${isNew ? " (new)" : ""}`,
    "",
    escapeText(finding2.message)
  ];
  if (finding2.file) {
    const line = finding2.line === void 0 ? "" : `, line ${finding2.line}`;
    sections.push("", `File: ${codeSpan(finding2.file)}${line}`);
  }
  if (owners.length > 0) {
    sections.push("", `Owners: ${listOwners(owners)}`);
  }
  if (finding2.recommendation) {
    sections.push("", `Recommendation: ${escapeText(finding2.recommendation)}`);
  }
  sections.push("", renderRule(finding2.ruleId));
  return sections.join("\n");
}
var maxOwnersShown = 5;
function listOwners(owners) {
  const unique2 = [...new Set(owners)];
  const shown2 = unique2.slice(0, maxOwnersShown).map(codeSpan).join(", ");
  return unique2.length > maxOwnersShown ? `${shown2} and ${unique2.length - maxOwnersShown} more` : shown2;
}
function renderOwnersQuestion(owners) {
  return owners.length === 0 ? [] : [`- Have the code owners of the flagged files, ${listOwners(owners)}, reviewed the change?`];
}
function renderRule(ruleId) {
  const url = ruleDocsUrl(ruleId);
  return `Rule: ${url === void 0 ? codeSpan(ruleId) : `[${codeSpan(ruleId)}](${url})`}`;
}
function escapeText(value) {
  return value.replace(/\r\n?|\n/g, " ").replace(/[\\`*_[\]<>#|!~&]/g, "\\$&");
}
function codeSpan(value) {
  const content = showHiddenCharacters(value.replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${padding}${content}${padding}${fence}`;
}
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function showHiddenCharacters(value) {
  const backslash = String.fromCharCode(92);
  return [...value].map((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return isHiddenCodePoint(codePoint) ? `${backslash}u{${codePoint.toString(16).toUpperCase()}}` : char;
  }).join("");
}

// src/reporting/render-sarif.ts
var levels = { high: "error", warning: "warning", info: "note" };
var severityOrder = ["info", "warning", "high"];
var securitySeverity = { high: "8.0", warning: "5.0", info: "2.0" };
var securityAreas = /* @__PURE__ */ new Set(["secrets", "supply-chain", "infrastructure", "code"]);
var docsHome = "https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md";
function renderSarif(result, rules) {
  const located = (finding2) => finding2.file !== void 0;
  const findings = result.findings.filter(located);
  const suppressed = (result.suppressed ?? []).filter(located);
  const results = [...findings.map((finding2) => sarifResult(finding2)), ...suppressed.map((finding2) => sarifResult(finding2, finding2))];
  const reported = /* @__PURE__ */ new Map();
  for (const finding2 of [...findings, ...suppressed]) {
    const current = reported.get(finding2.ruleId);
    if (current === void 0 || severityOrder.indexOf(finding2.severity) > severityOrder.indexOf(current)) {
      reported.set(finding2.ruleId, finding2.severity);
    }
  }
  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Prism Review",
              informationUri: "https://github.com/gabrielolvv/prism-review",
              rules: rules.map((rule) => sarifRule(rule, reported.get(rule.id)))
            }
          },
          results
        }
      ]
    },
    null,
    2
  );
}
function sarifRule(rule, severity) {
  const area = areaOf(rule.id);
  const security = securityAreas.has(area);
  const helpUri = ruleDocsUrl(rule.id) ?? docsHome;
  return {
    id: rule.id,
    name: rule.id,
    shortDescription: { text: rule.description },
    fullDescription: { text: rule.description },
    helpUri,
    // Code scanning shows the help on each alert.
    help: {
      text: `${rule.description} See ${helpUri} for what the rule reads, what it leaves out, and how to turn it off.`,
      markdown: `${rule.description}

[Read about \`${rule.id}\`](${helpUri}): what it reads, what it leaves out, and how to turn it off.`
    },
    ...severity === void 0 ? {} : { defaultConfiguration: { level: levels[severity] } },
    // Code scanning lets alerts be filtered by tag. A `security` tag and a security severity let it
    // rank alerts as High, Medium, or Low and let branch protection block on them.
    properties: {
      tags: security ? [area, "security"] : [area],
      ...security && severity !== void 0 ? { "security-severity": securitySeverity[severity] } : {},
      ...!security && severity !== void 0 ? { "problem.severity": severity === "high" ? "error" : severity === "warning" ? "warning" : "recommendation" } : {}
    }
  };
}
function sarifResult(finding2, suppressed) {
  const uri = fileUri(finding2.file ?? "");
  const otherLines = (finding2.lines ?? []).filter((line) => line !== finding2.line);
  return {
    ruleId: finding2.ruleId,
    level: levels[finding2.severity],
    message: { text: [finding2.message, finding2.recommendation].filter(Boolean).join(" ") },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          ...finding2.line === void 0 ? {} : { region: { startLine: finding2.line } }
        }
      }
    ],
    ...otherLines.length === 0 ? {} : {
      relatedLocations: otherLines.map((line, index) => ({
        id: index + 1,
        physicalLocation: { artifactLocation: { uri }, region: { startLine: line } },
        message: { text: `Also line ${line}.` }
      }))
    },
    // An inline suppression is SARIF's in-source suppression; code scanning shows it as dismissed.
    ...suppressed === void 0 ? {} : { suppressions: [{ kind: "inSource", justification: suppressed.suppressionReason }] }
  };
}
function fileUri(path2) {
  return path2.split("/").map(encodeURIComponent).join("/");
}

// src/reporting/render-text.ts
var styles = {
  high: "1;31",
  warning: "33",
  info: "36",
  bold: "1",
  dim: "2"
};
var labels13 = { high: "high", warning: "warning", info: "info" };
function renderText(result, options) {
  const paint = (style, text) => options.color ? `\x1B[${styles[style]}m${text}\x1B[0m` : text;
  const findings = (options.includeLowSeverity ? result.findings : result.findings.filter((finding2) => finding2.severity !== "info")).slice().sort(
    (left, right) => compareSeverity(left.severity, right.severity) || (left.file ?? "").localeCompare(right.file ?? "") || (left.line ?? 0) - (right.line ?? 0)
  );
  const width = Math.max(0, ...findings.map((finding2) => labels13[finding2.severity].length));
  const lines = [`${paint("bold", "Prism Review:")} ${paint(riskStyle(result.riskLevel), `${result.riskLevel} risk`)}. ${plain(result.summary)}`];
  if (findings.length > 0) {
    lines.push("");
  }
  for (const finding2 of findings) {
    const severity = labels13[finding2.severity].padEnd(width);
    lines.push(`${paint(finding2.severity, severity)}  ${location(finding2)}${plain(finding2.title)} ${paint("dim", `[${finding2.ruleId}]`)}`);
    lines.push(`${" ".repeat(width)}  ${plain(finding2.message)}`);
  }
  const notes = [
    ...(result.suppressed?.length ?? 0) > 0 ? [`${result.suppressed?.length} finding(s) acknowledged inline.`] : [],
    ...(result.dependencyChanges?.length ?? 0) > 0 ? [`${result.dependencyChanges?.length} dependency change(s).`] : [],
    ...findings.length > 0 || (result.dependencyChanges?.length ?? 0) > 0 ? ["Use --format markdown for recommendations and the reviewer checklist."] : []
  ];
  if (notes.length > 0) {
    lines.push("", paint("dim", notes.join(" ")));
  }
  return lines.join("\n");
}
function location(finding2) {
  if (finding2.file === void 0) {
    return "";
  }
  return `${plain(finding2.file)}${finding2.line === void 0 ? "" : `:${finding2.line}`}  `;
}
function riskStyle(risk) {
  return risk === "high" ? "high" : risk === "medium" ? "warning" : "bold";
}
function plain(value) {
  return [...value.replace(/\r\n?|\n/g, " ")].map((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    const control = codePoint < 32 || codePoint >= 127 && codePoint <= 159;
    return control || isHiddenCodePoint(codePoint) ? `\\u{${codePoint.toString(16).toUpperCase()}}` : char;
  }).join("");
}

// src/security/limit-patches.ts
function limitPatchSizes(files, maxPatchBytes) {
  return files.map((file) => {
    if (file.patch === void 0 || Buffer.byteLength(file.patch, "utf8") <= maxPatchBytes) {
      return { ...file };
    }
    return { ...file, patch: void 0, patchOmitted: true };
  });
}

// src/security/redact-secrets.ts
var redaction = "[REDACTED]";
var assignmentPatterns = [
  /\b(api[_-]?key|token|secret|secret[_-]?key(?:[_-]?base)?|session[_-]?secret|password|passwd|pwd|client[_-]?secret)\b[ \t]*[:=][ \t]*["']?[^"',\s]+/gi,
  /\b(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY)\b[ \t]*[:=][ \t]*["']?[^"',\s]+/g
];
var standaloneSecretPatterns = [
  ...credentialFormats.map((format) => format.pattern),
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
];
function redactSecrets(value, options = {}) {
  const allowlist2 = options.allowlist ?? [];
  let redacted = redactUrlPasswords(value, redaction, (password) => isAllowlisted(password, allowlist2));
  for (const pattern of assignmentPatterns) {
    redacted = redacted.replace(pattern, (match2) => {
      const separatorIndex = findSeparatorIndex(match2);
      if (separatorIndex === -1) {
        return redaction;
      }
      const assigned = match2.slice(separatorIndex + 1).trim().replace(/^["']/, "");
      if (isAllowlisted(assigned, allowlist2)) {
        return match2;
      }
      return `${match2.slice(0, separatorIndex + 1)} ${redaction}`;
    });
  }
  for (const pattern of standaloneSecretPatterns) {
    redacted = redacted.replace(
      pattern,
      (match2) => isAllowlisted(match2, allowlist2) ? match2 : redaction
    );
  }
  return redacted;
}
function redactChangedFiles(files, options = {}) {
  return files.map((file) => ({
    ...file,
    patch: file.patch ? redactSecrets(file.patch, options) : file.patch
  }));
}
function findSeparatorIndex(value) {
  const equalsIndex = value.indexOf("=");
  const colonIndex = value.indexOf(":");
  if (equalsIndex === -1) {
    return colonIndex;
  }
  if (colonIndex === -1) {
    return equalsIndex;
  }
  return Math.min(equalsIndex, colonIndex);
}

// src/security/prepare-changed-files.ts
function prepareChangedFiles(files, config2) {
  const { maxPatchBytes, redaction: redaction2 } = config2.security;
  const allowlist2 = redaction2.allowlist.map((source) => new RegExp(source));
  const scanned = detectSecrets(files, allowlist2).map((file) => ({
    ...file,
    hiddenLines: file.patch === void 0 ? [] : findHiddenLines(file.patch),
    // Redaction rewrites lines such as `const token = jwt.sign(...)`, so keys are found first.
    jwtKeyLines: file.patch === void 0 ? [] : findJwtKeyLines(file.path, file.patch),
    sessionSecretLines: file.patch === void 0 ? [] : findSessionSecretLines(file.path, file.patch),
    jwtExpiryLines: file.patch === void 0 ? [] : findJwtWithoutExpiryLines(file.path, file.patch),
    secretLogLines: file.patch === void 0 ? [] : findSecretLogLines(file.path, file.patch),
    urlCredentialLines: file.patch === void 0 ? [] : findUrlCredentialLines(file.path, file.patch, allowlist2),
    timingCompareLines: file.patch === void 0 ? [] : findTimingCompareLines(file.path, file.patch),
    ...file.patch !== void 0 && credentialFileKind(file.path)?.checksLines ? { credentialLines: findCredentialLines(file.path, file.patch) } : {},
    ...file.patch !== void 0 && isSourceFile(file.path) ? { lockfileSources: findLockfileSources(file.path, file.patch, config2.rules.lockfileSources.allowedSources) } : {}
  }));
  const limited = limitPatchSizes(scanned, maxPatchBytes);
  return redactChangedFiles(limited, { allowlist: allowlist2 });
}

// src/testing/parse-unified-diff.ts
var BACKSLASH = 92;
var QUOTE = 34;
function parseUnifiedDiff(diff) {
  const files = [];
  const sections = diff.split(/^diff --git /m).slice(1);
  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const header2 = lines[0] ?? "";
    const headerPaths = readHeaderPaths(header2);
    if (!headerPaths) {
      throw new Error(`Unrecognized diff header: diff --git ${header2}`);
    }
    const prefixed = hasPrefixes(headerPaths);
    const strip = (path3) => prefixed ? path3.slice(2) : path3;
    const status = detectStatus(lines);
    const oldPath = readMarkerPath(lines, "--- ", strip) ?? readRenamePath(lines, "rename from ") ?? strip(headerPaths[0]);
    const path2 = readMarkerPath(lines, "+++ ", strip) ?? readRenamePath(lines, "rename to ") ?? strip(headerPaths[1]);
    const patch = `diff --git ${section}`.trimEnd();
    const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
    files.push({
      path: path2,
      ...status === "renamed" ? { previousPath: oldPath } : {},
      status,
      additions,
      deletions,
      patch
    });
  }
  return files;
}
function hasPrefixes([oldPath, newPath]) {
  const prefix = /^[a-z]\//;
  return prefix.test(oldPath) && prefix.test(newPath) && oldPath[0] !== newPath[0];
}
function readHeaderPaths(header2) {
  if (header2.charCodeAt(0) === QUOTE) {
    const first = readQuoted(header2, 0);
    if (!first) {
      return void 0;
    }
    const rest = header2.slice(first.end).trimStart();
    const second = rest.charCodeAt(0) === QUOTE ? readQuoted(rest, 0)?.value : rest;
    return second ? [first.value, second] : void 0;
  }
  const quotedSecond = header2.indexOf(' "');
  if (quotedSecond > 0) {
    const second = readQuoted(header2, quotedSecond + 1);
    return second ? [header2.slice(0, quotedSecond), second.value] : void 0;
  }
  const prefixed = /^([a-z]\/.+?) ([a-z]\/.+)$/.exec(header2);
  if (prefixed?.[1] && prefixed[2] && prefixed[1][0] !== prefixed[2][0]) {
    return [prefixed[1], prefixed[2]];
  }
  const half = (header2.length - 1) / 2;
  if (Number.isInteger(half) && header2[half] === " " && header2.slice(0, half) === header2.slice(half + 1)) {
    return [header2.slice(0, half), header2.slice(half + 1)];
  }
  return void 0;
}
function readMarkerPath(lines, marker2, strip) {
  const line = lines.find((candidate) => candidate.startsWith(marker2));
  if (!line) {
    return void 0;
  }
  const raw = line.slice(marker2.length);
  const value = raw.charCodeAt(0) === QUOTE ? readQuoted(raw, 0)?.value : raw.split("	")[0];
  return value === void 0 || value === "/dev/null" ? void 0 : strip(value);
}
function readRenamePath(lines, marker2) {
  const raw = lines.find((line) => line.startsWith(marker2))?.slice(marker2.length);
  if (raw === void 0) {
    return void 0;
  }
  return raw.charCodeAt(0) === QUOTE ? readQuoted(raw, 0)?.value : raw;
}
function readQuoted(text, start) {
  const bytes = [];
  const named = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };
  for (let index = start + 1; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === QUOTE) {
      return { value: Buffer.from(bytes).toString("utf8"), end: index + 1 };
    }
    if (code !== BACKSLASH) {
      bytes.push(...Buffer.from(text[index] ?? "", "utf8"));
      continue;
    }
    const next = text[index + 1] ?? "";
    const octal = /^[0-7]{3}/.exec(text.slice(index + 1, index + 4));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += 3;
    } else if (next in named) {
      bytes.push(named[next] ?? 0);
      index += 1;
    } else {
      bytes.push(next.charCodeAt(0));
      index += 1;
    }
  }
  return void 0;
}
function detectStatus(lines) {
  if (lines.some((line) => line.startsWith("new file mode"))) {
    return "added";
  }
  if (lines.some((line) => line.startsWith("deleted file mode"))) {
    return "removed";
  }
  if (lines.some((line) => line.startsWith("rename from "))) {
    return "renamed";
  }
  return "modified";
}

// src/cli/init.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var workflowPath = ".github/workflows/prism-review.yml";
var actionRepository = "gabrielolvv/prism-review";
var commitLookupTimeoutMs = 5e3;
async function initRepository(options) {
  const uses = await chooseRef(options);
  const files = [
    [workflowPath, workflowYaml(uses)],
    [defaultConfigPath, starterConfig]
  ];
  const written = [];
  const skipped = [];
  for (const [path2, content] of files) {
    const target = (0, import_node_path.join)(options.directory, path2);
    if ((0, import_node_fs.existsSync)(target) && !options.force) {
      skipped.push(path2);
      continue;
    }
    (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(target), { recursive: true });
    (0, import_node_fs.writeFileSync)(target, content);
    written.push(path2);
  }
  return { written, skipped, uses };
}
async function chooseRef(options) {
  if (options.ref !== void 0) {
    return options.ref;
  }
  if (!/^\d+\.\d+\.\d+$/.test(options.version)) {
    return "v0";
  }
  const tag = `v${options.version}`;
  const commit = await (options.findReleaseCommit ?? findReleaseCommit)(tag).catch(() => void 0);
  return commit === void 0 ? "v0" : `${commit} # ${tag}`;
}
async function findReleaseCommit(tag) {
  const response = await fetch(`https://api.github.com/repos/${actionRepository}/commits/${encodeURIComponent(tag)}`, {
    headers: { Accept: "application/vnd.github.sha", "User-Agent": "prism-review-cli" },
    signal: AbortSignal.timeout(commitLookupTimeoutMs)
  });
  if (!response.ok) {
    return void 0;
  }
  const sha = (await response.text()).trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : void 0;
}
function workflowYaml(uses) {
  return `name: Prism Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: ${actionRepository}@${uses}
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          config-path: ${defaultConfigPath}
`;
}
var starterConfig = `# Prism Review configuration. Every option, with its default, is described in
# https://github.com/${actionRepository}/blob/master/docs/configuration.md
#
# The action reads this file from the pull request's base branch, so a change to it applies to
# the pull requests opened after it is merged.

check:
  # Fail the review job on findings of this severity: never, warning, or high. Mark the job as a
  # required status check in branch protection to block merges on them.
  failOn: never

comment:
  # upsert updates one comment on every push; append posts a new comment each time.
  mode: upsert
  # Questions of your own, added to the reviewer checklist of every review.
  checklist: []

# Files to leave out of the review, such as vendored or generated code that is not marked
# linguist-generated in .gitattributes.
ignorePaths: []
#  - "vendor/**"

# Change a rule's severity, or turn it off.
severity: {}
#  missing-tests: off
`;

// src/cli/version.ts
var version2 = true ? "0.84.0" : "development";

// src/cli/main.ts
var usage = [
  "Usage: prism-review analyze (--diff <path|-> | --staged | --base <ref>) [--config <path>]",
  "                            [--format text|markdown|json|sarif] [--fail-on never|warning|high]",
  "       prism-review init [--ref <ref>] [--force]",
  "",
  "analyze reviews a diff:",
  "  --diff <path|->   Unified diff to review, such as the output of `git diff`. Use - to read stdin.",
  "                    --fixture is accepted as an alias.",
  "  --staged          Review the changes staged for the next commit, as `git diff --cached` shows them.",
  "  --base <ref>      Review the changes on this branch since it left <ref>, such as origin/main,",
  "                    as `git diff <ref>...HEAD` shows them.",
  "  --config <path>   Configuration file. Defaults to .prism-review.yml when it exists.",
  "  --format <format> text, one line per finding, the default in a terminal; markdown, the pull",
  "                    request comment, the default otherwise; json; or sarif for code scanning.",
  "                    text is colored in a terminal, unless NO_COLOR is set, or when FORCE_COLOR is.",
  "  --fail-on <level> Exit with status 1 on findings of this severity, instead of check.failOn.",
  "",
  "init adds .github/workflows/prism-review.yml and .prism-review.yml to the repository in the",
  "current directory:",
  "  --ref <ref>       Use the action at this tag or commit, such as v0, instead of pinning the",
  "                    commit of this version's release.",
  "  --force           Replace the files when they already exist.",
  "",
  "  --version         Print the version.",
  "",
  "Example: prism-review analyze --base origin/main --fail-on high",
  ""
].join("\n");
var formats = ["text", "markdown", "json", "sarif"];
var failOnLevels = ["never", "warning", "high"];
var UsageError = class extends Error {
};
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--help" || command === "-h") {
    process.stdout.write(usage);
    return;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${version2}
`);
    return;
  }
  if (command === "init") {
    await init(args);
    return;
  }
  if (command !== "analyze") {
    throw new UsageError(command ? `Unknown command: ${command}` : "Missing command.");
  }
  const options = parseArgs(args);
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  const sources2 = [options.diff !== void 0, options.staged, options.base !== void 0].filter(Boolean).length;
  if (sources2 !== 1) {
    throw new UsageError(sources2 === 0 ? "Missing --diff, --staged, or --base." : "Use only one of --diff, --staged, and --base.");
  }
  if (options.config !== void 0 && !(0, import_node_fs2.existsSync)((0, import_node_path2.resolve)(options.config))) {
    throw new Error(`Configuration file not found: ${options.config}`);
  }
  const configPath = options.config ?? defaultConfigPath;
  const { config: config2, extendedPaths } = await loadLocalConfig(configPath);
  const diff = options.diff !== void 0 ? await readDiff(options.diff) : gitDiff(options.base);
  if (options.diff === void 0 && diff.trim() === "") {
    process.stdout.write("No changes to review.\n");
    return;
  }
  const files = prepareChangedFiles(parseDiff(diff), config2);
  const generated = !config2.ignoreGenerated ? void 0 : isFile(gitAttributesPath) ? parseGitAttributes((0, import_node_fs2.readFileSync)(gitAttributesPath, "utf8")) : defaultGeneratedFiles;
  const existingLockfiles = config2.rules.staleLockfiles.enabled ? await findLockfiles(
    files,
    async (directory) => (0, import_node_fs2.readdirSync)(directory === "" ? "." : directory, { withFileTypes: true }).flatMap(
      (entry) => entry.isFile() ? [entry.name] : []
    )
  ).catch(() => void 0) : void 0;
  const result = analyzePullRequest(files, config2, {
    configPath,
    extendedConfigPaths: extendedPaths,
    isGenerated: generated?.isGenerated,
    existingLockfiles
  });
  const codeOwners = config2.comment.codeOwners ? readLocalCodeOwners() : void 0;
  const format = options.format ?? (process.stdout.isTTY ? "text" : "markdown");
  process.stdout.write(`${render(result, format, { ...config2.comment, ownersOf: codeOwners?.ownersOf })}
`);
  const failOn = options.failOn ?? config2.check.failOn;
  const failing = failingFindings(result, failOn);
  if (failing.length > 0) {
    process.stderr.write(`${describeFailure(failing, failOn, options.failOn === void 0 ? "check.failOn" : "--fail-on")}
`);
    process.exitCode = 1;
  }
}
async function init(args) {
  let ref;
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage);
      return;
    }
    if (arg === "--force") {
      force = true;
    } else if (arg === "--ref") {
      ref = args[index + 1];
      if (ref === void 0 || !/^[\w.\/-]{1,100}$/.test(ref)) {
        throw new UsageError("--ref needs a tag, branch, or commit, such as v0.");
      }
      index += 1;
    } else {
      throw new UsageError(`Unknown option: ${arg}`);
    }
  }
  if (!(0, import_node_fs2.existsSync)(".git")) {
    throw new Error("Run prism-review init from the root of a Git repository.");
  }
  const result = await initRepository({ directory: ".", force, ref, version: version2 });
  for (const path2 of result.written) {
    process.stdout.write(`Created ${path2}
`);
  }
  for (const path2 of result.skipped) {
    process.stdout.write(`Left ${path2} unchanged because it exists; use --force to replace it.
`);
  }
  if (ref === void 0 && !result.uses.includes("#")) {
    process.stdout.write(
      "Could not look up this version's release commit, so the workflow uses gabrielolvv/prism-review@v0, which follows the latest 0.x release.\n"
    );
  }
  if (result.written.length > 0) {
    process.stdout.write(
      [
        "",
        "Next: commit these files and open a pull request. Prism Review reviews that pull request too, with the default",
        "configuration, since it reads .prism-review.yml from the base branch, and reports the new workflow and",
        "configuration as high risk, as it does for every change to them. Once merged, your configuration applies.",
        ""
      ].join("\n")
    );
  }
}
async function loadLocalConfig(configPath) {
  if (!isFile((0, import_node_path2.resolve)(configPath))) {
    return { config: defaultConfig, extendedPaths: [] };
  }
  const client = createGitHubClient(
    process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
    resolveGitHubApiUrl(process.env.GITHUB_API_URL)
  );
  return resolveConfig(
    (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(configPath), "utf8"),
    configPath,
    async (target) => {
      if (target.kind === "local") {
        return isFile(target.path) ? { raw: (0, import_node_fs2.readFileSync)(target.path, "utf8"), source: target.path } : void 0;
      }
      const raw = await fetchRepositoryFile(client, target.owner, target.repo, target.path, target.ref);
      return raw === void 0 ? void 0 : { raw, source: `${target.owner}/${target.repo}/${target.path}@${target.ref}` };
    },
    configPath
  );
}
function readLocalCodeOwners() {
  const path2 = codeOwnersPaths.find(isFile);
  return path2 === void 0 ? void 0 : parseCodeOwners((0, import_node_fs2.readFileSync)(path2, "utf8"));
}
function isFile(path2) {
  return (0, import_node_fs2.existsSync)(path2) && (0, import_node_fs2.statSync)(path2).isFile();
}
function render(result, format, options) {
  if (format === "text") {
    return renderText(result, { includeLowSeverity: options.includeLowSeverity, color: useColor() });
  }
  if (format === "json") {
    return renderJson(result);
  }
  if (format === "sarif") {
    return renderSarif(result, defaultRules);
  }
  return renderMarkdown(result, options);
}
function useColor() {
  if ((process.env.NO_COLOR ?? "") !== "") {
    return false;
  }
  const forced = process.env.FORCE_COLOR;
  return forced !== void 0 && forced !== "" ? forced !== "0" && forced !== "false" : process.stdout.isTTY === true;
}
function parseDiff(diff) {
  if (diff.trim() === "") {
    throw new Error(
      "The diff is empty. If it came from `git diff`, check that the command succeeded and that the range has changes."
    );
  }
  if (diff.includes(`${String.fromCharCode(27)}[`)) {
    throw new Error("The diff contains terminal color codes; run `git diff --no-color`.");
  }
  const files = parseUnifiedDiff(diff);
  if (files.length === 0) {
    throw new Error("No `diff --git` sections found. Pass the output of `git diff`, not a plain patch or a file list.");
  }
  return files;
}
function gitDiff(base) {
  const range2 = base === void 0 ? ["--cached"] : [`${base}...HEAD`];
  const result = (0, import_node_child_process.spawnSync)("git", ["diff", "--no-color", "--no-ext-diff", ...range2], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.error !== void 0) {
    throw new Error(`Could not run git: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git diff failed: ${result.stderr.trim().split("\n")[0] ?? ""}`);
  }
  return result.stdout;
}
async function readDiff(source) {
  if (source !== "-") {
    return (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(source), "utf8");
  }
  if (process.stdin.isTTY) {
    throw new UsageError("--diff - reads a diff from stdin; pipe one in, for example from `git diff`.");
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
function parseArgs(args) {
  const options = { staged: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--staged") {
      options.staged = true;
      continue;
    }
    if (arg === "--base") {
      const value = args[index + 1];
      if (value === void 0 || value.startsWith("-") || /\s/.test(value)) {
        throw new UsageError("--base needs a branch, tag, or commit, such as origin/main.");
      }
      options.base = value;
      index += 1;
      continue;
    }
    if (arg === "--fail-on") {
      const value = args[index + 1];
      if (!failOnLevels.includes(value)) {
        throw new UsageError("--fail-on needs never, warning, or high.");
      }
      options.failOn = value;
      index += 1;
      continue;
    }
    if (arg === "--diff" || arg === "--fixture" || arg === "--config" || arg === "--format") {
      const value = args[index + 1];
      if (value === void 0 || value.startsWith("--") && value !== "-") {
        throw new UsageError(`Missing value for ${arg}.`);
      }
      if (arg === "--config") {
        options.config = value;
      } else if (arg === "--format") {
        if (!formats.includes(value)) {
          throw new UsageError(`Unknown format: ${value}. Use text, markdown, json, or sarif.`);
        }
        options.format = value;
      } else {
        options.diff = value;
      }
      index += 1;
      continue;
    }
    throw new UsageError(`Unknown option: ${arg}`);
  }
  return options;
}
main().catch((error2) => {
  const message = error2 instanceof Error ? error2.message : String(error2);
  process.stderr.write(`Prism Review failed: ${message}
`);
  if (error2 instanceof UsageError) {
    process.stderr.write(`
${usage}`);
  }
  process.exitCode = 1;
});

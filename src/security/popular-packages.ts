// Widely used packages per registry, which typosquatters imitate. The list only needs the names
// worth imitating; a dependency named exactly like one of them is never reported.
export type Ecosystem = "npm" | "PyPI" | "RubyGems" | "crates.io";

export const popularPackages: Readonly<Record<Ecosystem, readonly string[]>> = {
  npm: [
    "react", "react-dom", "react-router", "react-router-dom", "react-redux", "redux", "redux-thunk",
    "vue", "vue-router", "vuex", "pinia", "svelte", "next", "nuxt", "preact", "jquery", "lodash",
    "underscore", "ramda", "axios", "request", "node-fetch", "superagent", "express", "koa",
    "fastify", "body-parser", "cors", "helmet", "morgan", "cookie-parser", "express-session",
    "passport", "jsonwebtoken", "bcrypt", "bcryptjs", "dotenv", "uuid", "nanoid", "moment", "dayjs",
    "date-fns", "luxon", "chalk", "commander", "yargs", "inquirer", "debug", "semver", "glob",
    "minimatch", "rimraf", "mkdirp", "fs-extra", "chokidar", "async", "bluebird", "rxjs",
    "socket.io", "socket.io-client", "mongoose", "mongodb", "mysql", "mysql2", "sequelize",
    "typeorm", "prisma", "knex", "redis", "ioredis", "graphql", "typescript", "ts-node", "tslib",
    "webpack", "webpack-cli", "webpack-dev-server", "babel-loader", "vite", "rollup", "esbuild",
    "parcel", "eslint", "prettier", "jest", "mocha", "chai", "sinon", "jasmine", "karma", "cypress",
    "puppeteer", "playwright", "supertest", "nodemon", "concurrently", "cross-env", "husky",
    "lint-staged", "classnames", "prop-types", "styled-components", "tailwindcss", "postcss",
    "autoprefixer", "sass", "less", "bootstrap", "three", "chart.js", "marked", "highlight.js",
    "cheerio", "jsdom", "xml2js", "yaml", "js-yaml", "ajv", "joi", "yup", "zod", "validator",
    "colors", "winston", "pino", "handlebars", "mustache", "nodemailer", "multer", "sharp", "jimp",
    "canvas", "aws-sdk", "firebase", "stripe", "twilio", "electron", "core-js",
    "regenerator-runtime", "immer", "immutable", "mobx", "zustand", "formik", "crypto-js",
    "node-forge", "ethers", "web3", "archiver", "adm-zip", "form-data", "mime", "mime-types",
    "iconv-lite", "string-width", "strip-ansi", "ansi-regex", "kleur", "picocolors", "execa",
    "cross-spawn", "shelljs", "compression", "serve-static", "http-proxy", "cookie", "lru-cache",
    "uglify-js", "terser", "cssnano", "css-loader", "style-loader", "file-loader", "ts-loader",
    "html-webpack-plugin", "lerna", "gulp", "grunt", "browserify", "vitest", "nock", "msw",
    "underscore.string", "qrcode", "pdfkit", "puppeteer-core", "discord.js", "openai", "cuid"
  ],
  PyPI: [
    "requests", "urllib3", "certifi", "idna", "charset-normalizer", "chardet", "numpy", "pandas",
    "scipy", "matplotlib", "seaborn", "scikit-learn", "tensorflow", "torch", "torchvision", "keras",
    "django", "djangorestframework", "flask", "fastapi", "starlette", "uvicorn", "gunicorn",
    "celery", "redis", "sqlalchemy", "psycopg2", "psycopg2-binary", "pymysql", "pymongo",
    "mysqlclient", "boto3", "botocore", "s3transfer", "awscli", "setuptools", "wheel", "pip",
    "six", "python-dateutil", "pytz", "pyyaml", "jinja2", "markupsafe", "click", "attrs",
    "packaging", "pyparsing", "cryptography", "pyopenssl", "cffi", "pycparser", "jmespath", "rsa",
    "pyasn1", "protobuf", "grpcio", "typing-extensions", "pydantic", "aiohttp", "httpx",
    "beautifulsoup4", "lxml", "pillow", "opencv-python", "selenium", "pytest", "pytest-cov",
    "pytest-mock", "mock", "coverage", "tox", "black", "flake8", "pylint", "mypy", "isort", "ruff",
    "colorama", "tqdm", "rich", "docutils", "sphinx", "jsonschema", "simplejson", "ujson", "orjson",
    "werkzeug", "itsdangerous", "paramiko", "fabric", "ansible", "docker", "kubernetes", "openai",
    "transformers", "nltk", "spacy", "scrapy", "twisted", "tornado", "gevent", "greenlet",
    "websocket-client", "websockets", "pyjwt", "oauthlib", "requests-oauthlib", "python-dotenv",
    "tabulate", "toml", "tomli", "filelock", "virtualenv", "platformdirs", "wrapt", "decorator",
    "more-itertools", "networkx", "sympy", "openpyxl", "xlsxwriter", "pyarrow", "dask", "numba",
    "plotly", "streamlit", "langchain", "marshmallow", "alembic", "peewee", "arrow", "pendulum",
    "pyzmq", "ipython", "jupyter", "notebook", "psutil", "pywin32", "pycryptodome", "bcrypt",
    "passlib", "argon2-cffi", "pyserial", "pygments", "termcolor", "loguru", "httplib2",
    "google-auth", "google-api-python-client", "azure-core", "pymssql", "elasticsearch", "scapy",
    "attr"
  ],
  RubyGems: [
    "rails", "rake", "rack", "bundler", "nokogiri", "json", "activesupport", "activerecord",
    "actionpack", "railties", "puma", "unicorn", "sinatra", "devise", "rspec", "rspec-rails",
    "minitest", "rubocop", "capybara", "sidekiq", "redis", "mysql2", "sqlite3", "faraday",
    "httparty", "rest-client", "jwt", "bcrypt", "byebug", "thor", "sass", "sprockets",
    "webpacker", "kaminari", "pundit", "cancancan", "omniauth", "carrierwave", "shrine",
    "factory_bot", "faker", "simplecov", "dotenv", "figaro", "multi_json", "i18n", "tzinfo",
    "concurrent-ruby", "mime-types", "rack-test", "rack-cors", "grape", "hanami", "sequel",
    "mongoid", "resque", "whenever", "capistrano", "foreman", "sentry-ruby", "newrelic_rpm", "haml",
    "slim", "erubi", "builder", "mail", "letter_opener", "aws-sdk", "stripe", "graphql",
    "dry-validation", "sorbet", "bootsnap", "listen", "spring", "turbolinks", "jbuilder"
  ],
  "crates.io": [
    "serde", "serde_json", "serde_derive", "serde_yaml", "tokio", "futures", "async-trait", "rand",
    "regex", "clap", "anyhow", "thiserror", "log", "env_logger", "tracing", "tracing-subscriber",
    "chrono", "time", "uuid", "lazy_static", "once_cell", "reqwest", "hyper", "axum", "actix-web",
    "warp", "rocket", "tonic", "prost", "bytes", "itertools", "rayon", "crossbeam", "parking_lot",
    "libc", "winapi", "windows", "syn", "quote", "proc-macro2", "bitflags", "byteorder", "base64",
    "sha2", "ring", "rustls", "openssl", "url", "http", "mime", "toml", "bincode", "csv", "diesel",
    "sqlx", "rusqlite", "redis", "structopt", "indicatif", "colored", "termcolor", "dirs",
    "tempfile", "walkdir", "glob", "num-traits", "smallvec", "arrayvec", "hashbrown", "indexmap",
    "criterion", "proptest", "mockall", "wasm-bindgen", "js-sys", "web-sys", "image", "nalgebra",
    "ndarray", "semver", "flate2", "zip", "dashmap", "memchr", "aho-corasick", "nom", "pest"
  ]
};

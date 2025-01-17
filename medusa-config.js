const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {}

// CORS when consuming Medusa from admin
const ADMIN_CORS =
  process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";

// CORS to avoid issues when consuming Medusa from a client
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000";

const DATABASE_TYPE = process.env.DATABASE_TYPE || "postgres";
const DATABASE_URL = process.env.DATABASE_URL || `postgres://postgres:postgres@localhost:5432`;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const plugins = [
  /*"medusa-plugin-reviews",*/
  {
    resolve: `medusa-plugin-meilisearch`,
    options: {
      // config object passed when creating an instance
      // of the MeiliSearch client
      config: {
        host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
        // apiKey: process.env.MEILISEARCH_API_KEY,
      },
      settings: {
        products: {
          indexSettings: {
            sortableAttributes: [
              "created_at",
              "external_id",
              "metadata.sales",

              "variants.prices.amount",
              "variants.prices.price_list_id",
            ],
            filterableAttributes: [
              "collection_id",
              "collection.handle",
              "handle",
              "variants.prices.amount",
              "variants.id",
              "variants.inventory_quantity",
              "id",

              "metadata.featured",
              "metadata.active",
              "metadata.sales",
              "metadata.created_at",
              "metadata.crossellingProductExternalIds",

              "metadata.low_discount_allow",
              "metadata.high_discount_allow",
              "metadata.medium_discount_allow",
            ],
            searchableAttributes: [
              "title",
              "external_id",
              "id",
              "variants.id",
            ],
            pagination: {
              maxTotalHits: 5000
            },
          },
          primaryKey: "id",
        },
      },
    },
  },
  // To enable the admin plugin, uncomment the following lines and run `yarn add @medusajs/admin`
  // {
  //   resolve: "@medusajs/admin",
  //   /** @type {import('@medusajs/admin').PluginOptions} */
  //   options: {
  //     autoRebuild: true,
  //   },
  // },
];

const modules = {
  eventBus: {
    resolve: "@medusajs/event-bus-redis",
    options: {
      redisUrl: REDIS_URL
    }
  },
  cacheService: {
    resolve: "@medusajs/cache-redis",
    options: {
      redisUrl: REDIS_URL
    }
  },
}

/** @type {import('@medusajs/medusa').ConfigModule["projectConfig"]} */
const projectConfig = {
  jwtSecret: process.env.JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET,
  database_database: "./medusa-db.sql",
  database_type: DATABASE_TYPE,
  store_cors: STORE_CORS,
  admin_cors: ADMIN_CORS,
}

if (REDIS_URL) {
  projectConfig.redis_url = REDIS_URL;
}

if (DATABASE_URL && DATABASE_TYPE === "postgres") {
  projectConfig.database_url = DATABASE_URL;
  delete projectConfig["database_database"];
}


/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig,
  plugins,
	modules,
};

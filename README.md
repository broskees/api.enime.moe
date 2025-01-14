# Enime API
Enime API is an open source API service for developers to access anime info (as well as their video sources)

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/nadeshikon)

## Installation

### Prerequisites
To deploy Enime API, you need following services:
1. Redis - You can get a free hosting at https://upstash.com/
2. PostgresSQL - You can get a free hosting at https://planetscale.com/
3. Node.js (>=v16) - You can install it at https://nodejs.org/en/download/
4. Pnpm - You can install it at https://pnpm.io/

### Steps
1. Install dependencies with ``pnpm install``
2. Create a ``.env`` file at the root of the project with the following properties:
```
PORT={the port that application is going to run on}
DATABASE_URL={the postgres database connection url}
REDIS_HOST={Redis host}
REDIS_PORT={Redis port}
REDIS_PASSWORD={Redis password}
```
3. Initialize prisma with ``pnpm prisma:generate``
4. Run ``pnpm run dev`` and the application will start at desginated port (default 3000 if not explicitly set)

### Docker
1. Run ``docker pull enime/api:1.0``
2. Plug the environment variables in (If you don't know how to do this please Google)

### Docker-Compose
1. Refer to ``docker-compose.yml`` in the project root to proceed

## Support
- We use Discord for quick suggestions & bug reports, please join [here](https://discord.gg/nxr8be8WGa)

## FAQ
* Do you download the videos yourself / is your API subject to DMCA compliant
  * No, Enime API never downloads the video from any source provider, only link will be returned from the response hence it is completely not subject to DMCA compliant

## Performance
* Enime API tries to only scrape anime that has necessity of being scraped through a semi-sophisticated algorithm, resulting in its capacity to keep track of thousands of anime at the same time with high performance.
  * On average, Enime API only uses ~300MB of RAM (spikes to ~1.3GB when intensively scraping) and <15% of CPU (80% when intensively scraping) while keeping track of ~6000 anime

## Credit
- https://github.com/consumet/consumet.ts - Some of the scraper logic from various anime sites
- https://github.com/consumet/consumet-api - Used as a backup scraper
- https://github.com/AniAPI-Team/AniAPI - Inspiration, as well as a bit of the Gogoanime scraping logic

import express from 'express'
import fetch from 'node-fetch'
import NodeCache from 'node-cache'
import e from 'express-status-monitor'

const app = express()
const cache = new NodeCache()
const regexChannelName = /"owner":{"videoOwnerRenderer":{"thumbnail":{"thumbnails":\[.*?\]},"title":{"runs":\[{"text":"(.+?)"/

const getLiveStream = async (url) => {
  // Try to get it from cache
  let data = await cache.get(url)

  if (data) {
    // Cache hit
    return JSON.parse(data)
  } else {
    // Cache miss
    data = {}

    try {
      const response = await fetch(url)

      if (response.ok) {
        const text = await response.text()
        const hlsManifestUrl = text.match(/(?<=hlsManifestUrl":").*\.m3u8/)?.[0]
        const channelName = regexChannelName.exec(text)?.[1]
        const thumbnail = text.match(/(?<=owner":{"videoOwnerRenderer":{"thumbnail":{"thumbnails":\[{"url":")[^=]*/)?.[0]

        data = { name: channelName, stream: hlsManifestUrl, logo: thumbnail }
      }
    } catch (error) {
      // console.log(error)
    }

    cache.set(url, JSON.stringify(data), 300)

    return data
  }
}

app.use(e())

app.get('/', (req, res, nxt) => {
  try {
    res.json({ message: 'Status OK' })
  } catch (err) {
    nxt(err)
  }
})

app.get('/channel/:id.m3u8', async (req, res, nxt) => {
  try {
    const url = `https://www.youtube.com/channel/${req.params.id}/live`
    const { stream } = await getLiveStream(url)

    if (stream) {
      res.redirect(stream)
    } else {
      res.sendStatus(204)
    }
  } catch (err) {
    nxt(err)
  }
})

app.get('/video/:id.m3u8', async (req, res, nxt) => {
  try {
    const url = `https://www.youtube.com/watch?v=${req.params.id}`
    const { stream } = await getLiveStream(url)

    if (stream) {
      res.redirect(stream)
    } else {
      res.sendStatus(204)
    }
  } catch (err) {
    nxt(err)
  }
})

app.get('/cache', async (req, res, nxt) => {
  try {
    const keys = cache.keys('*')

    const items = []

    for (const key of keys) {
      const data = JSON.parse(await cache.get(key))

      if (data) {
        items.push({
          url: key,
          name: data.name,
          logo: data.logo
        })
      }
    }

    res.json(items)
  } catch (err) {
    nxt(err)
  }
})

const port = process.env.PORT || 8080

app.listen(port, () => {
  console.log(`Express app (node ${process.version}) is running on port ${port}`)
})
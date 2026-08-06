// @ts-nocheck
Page({
  data: {
    sessionId: '',
  },
  onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    this.setData({ sessionId })
  },
})

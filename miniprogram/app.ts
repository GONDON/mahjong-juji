import { CLOUD_ENV_ID } from './config'

App({
  onLaunch() {
    // Guard: CI / Node tests have no wx.cloud; DevTools / device do after cloud is enabled.
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      })
    }
  },
})

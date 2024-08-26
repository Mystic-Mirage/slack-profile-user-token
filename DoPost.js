/**
 * Handle POST-requests form Slack
 *
 * @param {Events.DoPost} e
 * @returns {Content.TextOutput}
 */
function doPost(e) {
  console.log(e);

  if (e.parameter.payload) {
    /**
     * Process message buttons (just "Revoke" for now)
     */

    /** @type {{actions: {action_id: string, value: string}[], response_url: string}} */
    const payload = JSON.parse(e.parameter.payload);
    console.log(payload);

    for (const action of payload.actions) {
      if (action.action_id === "revoke") {
        const slack = new Slack();
        const result = slack.authRevoke(action.value);
        if (result.revoked || result.error === "token_revoked") {
          slack.deleteMessage(payload.response_url);
        }
      }
    }
  } else if (e.postData.contents) {
    /**
     * Process event subscription requests
     */

    /** @type {
     * {type: "url_verification", challenge: string} |
     * {type: "event_callback", event: {type: "app_home_opened", user: string}}
     * }
     */
    const contents = JSON.parse(e.postData.contents);
    console.log(contents);

    switch (contents.type) {
      case "url_verification":
        /** `url_verification` is required to add an URL for sending subscribed events */
        return ContentService.createTextOutput(contents.challenge);
      case "event_callback":
        /** process events here */
        switch (contents.event.type) {
          case "app_home_opened":
            /** show an app's home screen for a user */
            const slack = new Slack();
            slack.publishHome(contents.event.user);
        }
    }
  }

  return ContentService.createTextOutput("");
}

function doPost(e) {
  console.log(e);
  if (e.parameter.payload) {
    /** @type {{actions: {action_id: string}[], response_url: string}} */
    const payload = JSON.parse(e.parameter.payload);
    console.log(payload);

    for (const action of payload.actions) {
      if (action.action_id === "revoke") {
        const slack = new Slack();
        /** @type {{revoked: boolean, error?: string }} */
        const result = slack.authRevoke(action.value);
        if (result.revoked || result.error === "token_revoked") {
          slack.deleteMessage(payload.response_url);
        }
      }
    }
  } else if (e.postData.contents) {
    /** @type {
     * {type: "url_verification", challenge: string} |
     * {type: "event_callback", event: {type: "app_home_opened", user: string}}
     * }
     */
    const contents = JSON.parse(e.postData.contents);
    console.log(contents);

    switch (contents.type) {
      case "url_verification":
        return ContentService.createTextOutput(contents.challenge);
      case "event_callback":
        switch (contents.event.type) {
          case "app_home_opened":
            const slack = new Slack();
            slack.publishHome(contents.event.user);
        }
    }
  }

  return ContentService.createTextOutput("");
}

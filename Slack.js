/**
 * Working with Slack API
 */
class Slack {
  constructor() {
    const props = PropertiesService.getScriptProperties().getProperties();
    /** @private */
    this.clientId = props.CLIENT_ID;
    /** @private */
    this.clientSecret = props.CLIENT_SECRET;
    /** @private */
    this.botToken = props.BOT_TOKEN;
    /** @private */
    this.url = "https://slack.com/api/";
  }

  /**
   * Generate API URL with specified path
   *
   * @private
   * @param {string} path
   * @returns {string}
   */
  apiUrl(path) {
    return `${this.url}${path}`;
  }

  /**
   * Fill content type and authorization header for UrlFetchApp.fetch
   *
   * @private
   * @param {{[p: string]: string}} [data]
   * @param {boolean} json
   * @returns {URL_Fetch.URLFetchRequestOptions}
   */
  prepareFetchParams(data, json) {
    const params = {
      contentType: json ? "application/json; charset=utf-8" : "application/x-www-form-urlencoded",
    };

    if (json) {
      params.headers = {
        Authorization: `Bearer ${this.botToken}`,
      };
    }

    return {...params, ...data};
  }

  /**
   * Perform POST-request
   *
   * @private
   * @param {string} url
   * @param {{[p: string]: any}} data
   * @param {boolean} [json=true]
   */
  post(url, data, json = true) {
    const params = this.prepareFetchParams(
      {
        method: "post",
        payload: json ? JSON.stringify(data) : data,
      },
      json,
    );

    const result = UrlFetchApp.fetch(url, params);
    const response = result.getContentText();
    console.log(response);
    return JSON.parse(response);
  }

  /**
   * Slack API helper for POST-requests
   *
   * @private
   * @param {string} path
   * @param {{[p: string]: any}} data
   * @param {boolean} [json=true]
   */
  postApi(path, data, json = true) {
    const url = this.apiUrl(path);
    return this.post(url, data, json);
  }

  * listImChannels() {
    let nextCursor = "";
    for (let count = 0; count < 10; count++) {
      const data = {
        cursor: nextCursor,
        token: this.botToken,
        types: "im",
      };
      /** @type {{channels: {id: string, user: string}[], response_metadata?: {next_cursor: string}}} */
      const conversations = this.postApi("conversations.list", data, false);

      if (!conversations.channels) break;

      for (const channel of conversations.channels) {
        yield channel;
      }

      nextCursor = conversations.response_metadata && conversations.response_metadata.next_cursor;

      if (!nextCursor) break;
    }
  }

  /**
   * Get Slack channel messages
   *
   * @private
   * @param {string} channelId
   * @yields {{ts: string}}
   */
  * readHistory(channelId) {
    let nextCursor = "";
    for (let count = 0; count < 10; count++) {
      const data = {
        channel: channelId,
        cursor: nextCursor,
      };
      /** @type {{has_more: boolean, messages: {ts: string}[], response_metadata?: {next_cursor: string}}} */
      const history = this.postApi("conversations.history", data);

      if (!history.messages) break;

      for (const message of history.messages) {
        yield message;
      }

      if (!history.has_more) break;

      nextCursor = history.response_metadata.next_cursor;
    }
  }

  /**
   * Delete all messages in user's direct conversation
   *
   * @param {string} userId
   */
  deleteAllMessages(userId) {
    let channelId;

    for (const conversation of this.listImChannels()) {
      if (conversation.user === userId) {
        channelId = conversation.id;
        break;
      }
    }

    if (!channelId) return;

    for (const message of this.readHistory(channelId)) {
      const data = {
        channel: channelId,
        ts: message.ts,
      };

      this.postApi("chat.delete", data);
    }
  }

  /**
   * Authorize an OAuth 2.0 request
   *
   * @param {string} code
   * @returns {{authed_user: {id: string, access_token: string}, error?: string}}
   */
  oAuthV2Access(code) {
    const data = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
    }
    return this.postApi("oauth.v2.access", data, false);
  }

  /**
   * Revoke a token
   *
   * @param {string} token
   * @returns {{revoked?: boolean, error?: string}}
   */
  authRevoke(token) {
    return this.postApi("auth.revoke", {token: token}, false);
  }

  /**
   * Post a message to a Slack channel (DM to a user)
   *
   * @param {string} channelId
   * @param {string} token
   */
  sendMessage(channelId, token) {
    const data = {
      channel: channelId,
      text: `Your token:\n${token}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Your token:* ```" + token + "```",
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Revoke"
              },
              style: "danger",
              value: token,
              action_id: "revoke",
            },
          ]
        },
      ]
    };

    this.postApi("chat.postMessage", data);
  }

  /**
   * Delete a message by its response URL
   *
   * @param {string} responseUrl
   */
  deleteMessage(responseUrl) {
    this.post(responseUrl, {delete_original: true});
  }

  /**
   * Post home tab content for a user
   *
   * @param {string} userId
   */
  publishHome(userId) {
    const userScopeEncoded = encodeURI("users:read,users:write,users.profile:read,users.profile:write");
    const redirectUrlEncoded = encodeURI(ScriptApp.getService().getUrl());
    const view = {
      "type": "home",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "TL;DR"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "Push the green button, get your token, and update your Slack status using cURL:"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "```curl -H \"Authorization: Bearer <YOUR_TOKEN>\" -H \"Content-Type: application/json; charset=utf-8\" -d '{\"profile\": {\"status_emoji\": \":robot_face:\", \"status_text\": \"I'\\''m a robot\"}}' https://slack.com/api/users.profile.set```"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "More about changing your status can be found <https://api.slack.com/apis/presence-and-status|here>"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "Of course, you can use anything you like besides cURL"
          }
        },
        {
          "type": "divider"
        },
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "Some details"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "This application allows you to get a token that can be used by any HTTP transferring library/utility to update your profile info. You can get your profile info either"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "This whole thing is created with automatic updating of your Slack status in mind"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "By pressing the `Authorize` button below you give the application access to create a token on your behalf"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "You will receive your token to the app's private messages. You can revoke it right from there"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "Slack API allows only a single user token per application, so multiple access requests do nothing but return the same token every time. To change the token, revoke it first and then re-authorize the app again"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "_*Beware!* This token allows you to update all your profile info that is *NOT* exclusively limited to your status_"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Source code: <https://github.com/Mystic-Mirage/slack-profile-user-token>"
          }
        },
        {
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Authorize"
              },
              "style": "primary",
              "url": `https://slack.com/oauth/v2/authorize?user_scope=${userScopeEncoded}&redirect_uri=${redirectUrlEncoded}&client_id=${this.clientId}`
            }
          ]
        }
      ]
    };

    const data = {user_id: userId, view: view};
    this.postApi("views.publish", data);
  }
}

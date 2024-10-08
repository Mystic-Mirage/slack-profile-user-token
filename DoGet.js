/**
 * Process authorization request
 * 1. Take a `code` parameter value from the request
 * 2. Use it to get a user token
 * 3. Delete all messages from user's DM
 * 4. Send a message with user's token to user
 *
 * @param {Events.DoGet} e
 * @returns {HTML.HtmlOutput | Content.TextOutput}
 */
function doGet(e) {
  if (e.parameter.code) {
    const slack = new Slack();
    const result = slack.oAuthV2Access(e.parameter.code);

    if (result.authed_user && result.authed_user.id && result.authed_user.access_token) {
      slack.deleteAllMessages(result.authed_user.id);
      slack.sendMessage(result.authed_user.id, result.authed_user.access_token);

      return HtmlService.createHtmlOutput(
        `<div style="width: 100%; text-align: center;"><h1>Success! 🥳</h1><h3>Find your token in the app's direct messages</h3></div>`
      );
    }

    return ContentService.createTextOutput(result.error || "");
  }

  return ContentService.createTextOutput("");
}

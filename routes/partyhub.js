// partyhubRoutes.js
// Converted from Go (gin) to Node.js (Express)

const express = require("express");
const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the Bearer token from an Authorization header.
 * Returns the token string, or null if missing / malformed.
 */
function extractToken(req) {
  const auth = req.headers["authorization"] || "";
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
}

// ── main GraphQL dispatcher ───────────────────────────────────────────────────

router.post("/partyhub/graphql", async (req, res) => {
  const { operationName, query, variables } = req.body;

  if (!operationName && !query) {
    return res.status(500).json({ error: "Error binding JSON" });
  }

  switch (operationName) {
    case "GetStatusPerService":
      return kairosLightSwitch(req, res);
    case "GetMyAccount":
      return getUserAccount(req, res);
    case "UpdateUserSetting":
      return updateUserSetting(req, res, variables);
    case "GetMySetting":
      return getUserSetting(req, res, variables);
    case "GetAccountSettings":
      return getAccountSettings(req, res, variables);
    case "EulaAccepted":
      return eulaAccepted(req, res);
    case "getMySocialBanSummary":
      return getMySocialBanSummary(req, res);
    case "GetNotificationSettings":
      return getNotificationSettings(req, res);
    case "GetSummary":
      return getFriends(req, res);
    case "GetLastOnlineSummary":
    case "GetFriendSubscriptionsSummary":
      return nullPresence(req, res);
    case "GetSubscriptionSettings":
      return getSubscriptionSettings(req, res);
    case "GetAccountWithFriendshipStatus":
      return searchKairosUsers(req, res, variables);
    case "SetSubscriptionSettings":
      return setSubscriptionSettings(req, res);
    case "SetPartyNotificationSettings":
      return setPartyNotificationSettings(req, res, variables);
    case "GetEula":
      return getKairosEula(req, res, variables);
    case "AcceptEula":
      return acceptKairosEula(req, res);
    case "inviteFriend":
      return inviteFriend(req, res, variables);
    case "GetMySettingOption":
      return getMySettingOption(req, res, variables);
    default:
      console.debug(
        `OperationName: ${operationName}\nQuery: ${query}\nVariables: ${JSON.stringify(variables)}`
      );
      return res.status(404).json({
        [operationName]: {
          __typename: operationName,
          myAccount: null,
          error: "errors.com.frost.common.not_found",
        },
      });
  }
});

// ── route handlers ────────────────────────────────────────────────────────────

function kairosLightSwitch(req, res) {
  return res.status(200).json({
    data: {
      ContentControl: {
        __typename: "ContentControlQuery",
        namespace: {
          __typename: "ContentControlNamespace",
          result: {
            __typename: "ContentControlRules",
            canUseVoiceChat: true,
          },
        },
      },
      LightSwitch: {
        __typename: "LightSwitchQuery",
        fortniteStatus: {
          __typename: "LightSwitchServiceStatus",
          banned: false,
          status: "UP",
        },
        kairosStatus: {
          __typename: "LightSwitchServiceStatus",
          status: "DOWN",
        },
      },
      SocialBan: {
        __typename: "SocialBanQuery",
        summary: {
          __typename: "SocialBanSummary",
          warnings: [],
          bans: [],
        },
      },
    },
    extensions: {},
  });
}

async function getUserAccount(req, res) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const tokenStore = await db.findToken(token);
  if (!tokenStore) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const user = await db.findUserByAccountID(tokenStore.accountID);
  if (!user) {
    return res.status(404).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  return res.status(200).json({
    data: {
      Account: {
        __typename: "Account",
        myAccount: {
          __typename: "MyAccount",
          id: user.accountID,
          displayName: user.username,
          email: user.email,
          country: "MA",
          externalAuths: [],
        },
      },
      Fortnite: {
        __typename: "Fortnite",
        myuser: {
          __typename: "Myuser",
          id: user.accountID,
        },
      },
    },
  });
}

async function updateUserSetting(req, res, variables) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "missing authorization header" });

  const tokenStore = await db.findToken(token);
  if (!tokenStore) return res.status(401).json({ error: "invalid token" });

  const user = await db.findUserByAccountID(tokenStore.accountID);
  if (!user) return res.status(404).json({ error: "user not found" });

  const { key, value } = variables || {};
  if (key === undefined || value === undefined) {
    return res.status(400).json({ error: "missing key or value" });
  }

  const changes = {};
  if (key === "avatar" && typeof value === "string") {
    changes["partyhub.avatar"] = value;
  } else if (key === "avatarBackground" && typeof value === "string") {
    changes["partyhub.avatarBackground"] = value;
  } else {
    return res.status(400).json({ error: "invalid key" });
  }

  if (Object.keys(changes).length > 0) {
    const ok = await db.updateUser(user.accountID, changes);
    if (!ok) return res.status(500).json({ error: "failed to update user" });
  }

  return res.status(200).json({
    data: {
      UserSettings: {
        __typename: "UserSettingsMutation",
        updateSetting: {
          __typename: "UserSettingMutationStatus",
          success: true,
        },
      },
    },
  });
}

async function getUserSetting(req, res, variables) {
  const { key } = variables || {};
  if (!key) return res.status(400).json({ error: "key missing" });

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const tokenStore = await db.findToken(token);
  if (!tokenStore) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const user = await db.findUserByAccountID(tokenStore.accountID);
  if (!user) {
    return res.status(404).json({
      GetUserAccount: {
        __typename: "AccountQuery",
        myAccount: null,
        error: "errors.com.frost.modules.users.not_found",
      },
    });
  }

  let value = "";
  if (key === "avatar") {
    value = user.partyhub?.avatar || "cid_001_athena_commando_f_default";
  } else if (key === "avatarBackground") {
    value = user.partyhub?.avatarBackground || "";
  }

  return res.status(200).json({
    data: {
      UserSettings: {
        __typename: "UserSettingsQuery",
        mySetting: [
          {
            __typename: "MySetting",
            accountId: user.accountID,
            value,
          },
        ],
      },
    },
  });
}

async function getAccountSettings(req, res, variables) {
  const { key, accountIds } = variables || {};
  if (!key) return res.status(400).json({ error: "key missing" });
  if (!accountIds || !Array.isArray(accountIds)) {
    return res.status(400).json({ error: "accountIds missing or invalid" });
  }

  const settings = await Promise.all(
    accountIds.map(async (id) => {
      const user = await db.findUserByAccountID(id);
      if (!user) return { __typename: "Setting", value: "", accountId: id };

      let value = "";
      if (key === "avatar") {
        value = user.partyhub?.avatar || "cid_001_athena_commando_f_default";
      } else if (key === "avatarBackground") {
        value = user.partyhub?.avatarBackground || "";
      }

      return { __typename: "Setting", value, accountId: id };
    })
  );

  return res.status(200).json({
    data: {
      UserSettings: {
        __typename: "UserSettings",
        setting: settings,
      },
    },
  });
}

function eulaAccepted(req, res) {
  return res.status(200).json({
    data: {
      Eula: {
        __typename: "EulaQuery",
        hasAccountAccepted: {
          __typename: "Eula",
          accepted: false,
        },
      },
    },
  });
}

function getMySocialBanSummary(req, res) {
  return res.status(200).json({
    data: {
      SocialBan: {
        __typename: "SocialBanQuery",
        summary: {
          __typename: "SocialBanSummary",
          warnings: [],
          bans: [],
        },
      },
    },
  });
}

function getNotificationSettings(req, res) {
  return res.status(200).json({
    data: {
      Friends: {
        __typename: "Friends",
        notificationSettings: {
          __typename: "NotificationSettings",
          offline: { __typename: "OfflineSettings", suppress_all: false },
          success: true,
          message: "",
        },
      },
      PartySettings: {
        __typename: "PartySettings",
        notificationSettings: {
          __typename: "NotificationSettings1",
          offline: { __typename: "OfflineSettings", suppress_all: false },
          success: true,
          message: "",
        },
      },
    },
  });
}

async function getFriends(req, res) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "GetSummary",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const tokenStore = await db.findToken(token);
  if (!tokenStore) {
    return res.status(401).json({
      GetUserAccount: {
        __typename: "GetSummary",
        myAccount: null,
        error: "errors.com.frost.common.not_found",
      },
    });
  }

  const friends = await db.findFriendsByAccountID(tokenStore.accountID);
  if (!friends) {
    return res.status(200).json({
      data: {
        Friends: {
          __typename: "Friends",
          summary: {
            __typename: "Summary",
            friends: [],
            incoming: [],
            outgoing: [],
            suggested: [],
            blocklist: [],
          },
        },
      },
    });
  }

  const mapFriendEntry = async (list) => {
    return Promise.all(
      list.map(async (f) => {
        const user = await db.findUserByAccountID(f.accountID);
        const displayName = user?.username || f.accountID;
        const created = new Date(f.created).toISOString().replace(/(\.\d{3})Z$/, ".000Z");
        return {
          __typename: "Friend",
          accountId: f.accountID,
          displayName,
          alias: "",
          created,
          connections: [],
        };
      })
    );
  };

  return res.status(200).json({
    data: {
      Friends: {
        __typename: "Friends",
        summary: {
          __typename: "Summary",
          friends: await mapFriendEntry(friends.list.accepted),
          incoming: await mapFriendEntry(friends.list.incoming),
          outgoing: await mapFriendEntry(friends.list.outgoing),
          suggested: [],
          blocklist: await mapFriendEntry(friends.list.blocked),
        },
      },
    },
  });
}

function nullPresence(req, res) {
  return res.status(200).json({ data: { PresenceV2: null } });
}

function getSubscriptionSettings(req, res) {
  return res.status(200).json({
    data: {
      PresenceV2: {
        __typename: "PresenceV2",
        getSubscriptionSettings: {
          __typename: "GetSubscriptionSettings",
          broadcast: { __typename: "Broadcast", enabled: true },
        },
      },
    },
  });
}

function setSubscriptionSettings(req, res) {
  return res.status(200).json({
    data: {
      PresenceV2: {
        __typename: "PresenceV2",
        modifySubscriptionSettings: {
          __typename: "ModifySubscriptionSettings",
          success: true,
        },
      },
    },
  });
}

function setPartyNotificationSettings(req, res, variables) {
  const { namespace, value } = variables || {};
  if (!namespace) return res.status(400).json({ error: "namespace missing or invalid" });
  if (!value) return res.status(400).json({ error: "value missing" });
  if (typeof value !== "object") return res.status(400).json({ error: "invalid value" });

  const suppressAll = value.offline?.suppress_all === true;

  return res.status(200).json({
    data: {
      PartySettings: {
        __typename: "PartySettingsMutation",
        setNotificationSettings: {
          __typename: "SetNotificationSettingsResponse",
          offline: { __typename: "OfflineSettings", suppress_all: suppressAll },
          success: true,
          status: "SUCCESS",
        },
      },
    },
  });
}

function getKairosEula(req, res, variables) {
  const { id, locale } = variables || {};
  if (!id) return res.status(400).json({ error: "id missing" });
  if (!locale) return res.status(400).json({ error: "locale missing" });

  return res.status(200).json({
    data: {
      Eula: {
        __typename: "Eula",
        getLatestAndConvert: {
          __typename: "EulaEntry",
          id,
          key: "fn",
          version: 5,
          title: "Frostbite End User License Agreement",
          body: `By playing Frostbite, you agree to the following terms:

1. Frostbite is a fan-made private server project designed to let players relive the original Fortnite experience. It is not affiliated with or endorsed by Epic Games, Inc.

2. All Fortnite trademarks, logos, and intellectual property remain the property of Epic Games, Inc. Frostbite makes no claim of ownership over these assets.

3. Frostbite exists to provide players with a nostalgic Fortnite experience, maintaining classic gameplay and features for community enjoyment.

4. Cheating, exploiting, or using third-party modifications is strictly prohibited. By playing Frostbite, you agree to respect other players and the integrity of the server.

5. Only use the official Frostbite client. Unauthorized or unverified clients may result in a permanent ban.

6. By connecting to Frostbite, you accept these terms and agree to enjoy the original Fortnite experience responsibly.`,
          locale,
          accepted: false,
        },
      },
    },
  });
}

function acceptKairosEula(req, res) {
  return res.status(200).json({
    data: {
      Eula: {
        __typename: "Eula",
        acceptEula: {
          __typename: "EulaEntry",
          accepted: true,
        },
      },
    },
  });
}

async function searchKairosUsers(req, res, variables) {
  const displayName = variables?.displayName || "";

  const token = extractToken(req);
  if (!token) return res.status(200).json({ data: { Account: null } });

  const tokenStore = await db.findToken(token);
  if (!tokenStore) return res.status(200).json({ data: { Account: null } });

  const [friends, users] = await Promise.all([
    db.findFriendsByAccountID(tokenStore.accountID),
    db.findUsersByUsername(displayName),
  ]);

  if (!users || users.length === 0) {
    return res.status(200).json({ data: { Account: null } });
  }

  const results = users.map((u) => {
    let status = "NOT_FRIEND";

    if (u.accountID === tokenStore.accountID) {
      status = "MYSELF";
    } else if (friends) {
      if (friends.list.accepted.some((f) => f.accountID === u.accountID)) {
        status = "FRIEND";
      } else if (friends.list.incoming.some((f) => f.accountID === u.accountID)) {
        status = "RECEIVED_INVITE";
      } else if (friends.list.outgoing.some((f) => f.accountID === u.accountID)) {
        status = "SENT_INVITE";
      } else if (friends.list.blocked.some((f) => f.accountID === u.accountID)) {
        status = "BLOCKED";
      }
    }

    return {
      __typename: "AccountEntry",
      id: u.accountID,
      displayName: u.username,
      friendshipStatus: status,
      externalAuths: [],
    };
  });

  return res.status(200).json({
    data: {
      Account: {
        __typename: "Account",
        account: results,
      },
    },
  });
}

async function inviteFriend(req, res, variables) {
  const failResponse = () =>
    res.status(200).json({
      data: {
        Friends: {
          __typename: "FriendMutation",
          invite: { __typename: "InviteResult", success: false },
          list: { accepted: [], incoming: [], outgoing: [], blocked: [] },
        },
      },
    });

  const friendId = variables?.friendId;
  if (!friendId) return failResponse();

  const token = extractToken(req);
  if (!token) return failResponse();

  const tokenStore = await db.findToken(token);
  if (!tokenStore) return failResponse();

  const accountId = tokenStore.accountID;
  const now = new Date().toISOString();

  let senderFriends = await db.findFriendsByAccountID(accountId) || {
    accountID: accountId,
    list: { accepted: [], incoming: [], outgoing: [], blocked: [] },
  };

  let recipientFriends = await db.findFriendsByAccountID(friendId) || {
    accountID: friendId,
    list: { accepted: [], incoming: [], outgoing: [], blocked: [] },
  };

  // Already friends?
  if (senderFriends.list.accepted.some((f) => f.accountID === friendId)) {
    return failResponse();
  }

  const incomingIdx = senderFriends.list.incoming.findIndex((f) => f.accountID === friendId);

  if (incomingIdx >= 0) {
    // Accept the pending invite
    senderFriends.list.accepted.push(senderFriends.list.incoming[incomingIdx]);
    senderFriends.list.incoming.splice(incomingIdx, 1);

    recipientFriends.list.accepted.push({ accountID: accountId, created: now });
    recipientFriends.list.outgoing = recipientFriends.list.outgoing.filter(
      (f) => f.accountID !== accountId
    );
  } else {
    // Already sent?
    if (senderFriends.list.outgoing.some((f) => f.accountID === friendId)) {
      return failResponse();
    }
    senderFriends.list.outgoing.push({ accountID: friendId, created: now });
    recipientFriends.list.incoming.push({ accountID: accountId, created: now });
  }

  await db.saveFriends(accountId, { list: senderFriends.list });
  await db.saveFriends(friendId, { list: recipientFriends.list });

  const buildFriendResponse = async (entries) => {
    return Promise.all(
      entries.map(async (f) => {
        const user = await db.findUserByAccountID(f.accountID);
        const created = new Date(f.created).toISOString().replace(/(\.\d{3})Z$/, ".000Z");
        return {
          __typename: "Friend",
          accountId: f.accountID,
          displayName: user?.username || "",
          alias: "",
          created,
          connections: [],
        };
      })
    );
  };

  const updatedSender = await db.findFriendsByAccountID(accountId);
  return res.status(200).json({
    data: {
      Friends: {
        __typename: "FriendMutation",
        invite: { __typename: "InviteResult", success: true },
        list: {
          accepted: await buildFriendResponse(updatedSender.list.accepted),
          incoming: await buildFriendResponse(updatedSender.list.incoming),
          outgoing: await buildFriendResponse(updatedSender.list.outgoing),
          blocked: await buildFriendResponse(updatedSender.list.blocked),
        },
      },
    },
  });
}

function getMySettingOption(req, res, variables) {
  const key = variables?.key;

  if (key === "avatarBackground") {
    return res.status(200).json({
      data: {
        UserSettings: {
          __typename: "UserSettings",
          myAvailableSetting: [
            '["#8EFDE5","#1CBA9E","#034D3F"]',
            '["#FF81AE","#D8033C","#790625"]',
            '["#FFDF00","#FBA000","#975B04"]',
            '["#CCF95A","#30C11B","#194D12"]',
            '["#B4F2FE","#00ACF2","#005679"]',
            '["#1CA2E6","#0C5498","#081E3E"]',
            '["#FFB4D6","#FF619C","#7D3449"]',
            '["#F16712","#D8033C","#6E0404"]',
            '["#AEC1D3","#687B8E","#36404A"]',
            '["#FFAF5D","#FF6D32","#852A05"]',
            '["#E93FEB","#7B009C","#500066"]',
            '["#DFFF73","#86CF13","#404B07"]',
            '["#B35EEF","#4D1397","#2E0A5D"]',
          ],
        },
      },
    });
  }

  if (key === "avatar") {
    return res.status(200).json({
      data: {
        UserSettings: {
          __typename: "UserSettings",
          myAvailableSetting: [
            "cid_001_athena_commando_f_default",
            "cid_002_athena_commando_f_default",
            "cid_003_athena_commando_f_default",
            "cid_004_athena_commando_f_default",
            "cid_005_athena_commando_m_default",
            "cid_006_athena_commando_m_default",
            "cid_007_athena_commando_m_default",
            "cid_008_athena_commando_m_default",
            // … (lista completa omitida por brevidade, igual ao Go original)
            "stw_constructor_f",
            "stw_constructor_m",
            "stw_ninja_f",
            "stw_ninja_m",
            "stw_outlander_f",
            "stw_outlander_m",
            "stw_soldier_f",
            "stw_soldier_m",
          ],
        },
      },
    });
  }

  return res.status(400).json({ error: "invalid key" });
}

// ── export ────────────────────────────────────────────────────────────────────

module.exports = router;

// ── NOTE: substitui `db` pelas tuas funções reais de base de dados ────────────
// Exemplo de interface esperada:
//
//   db.findToken(token)                      → { accountID } | null
//   db.findUserByAccountID(id)               → { accountID, username, email, partyhub } | null
//   db.updateUser(accountID, changes)        → true | false
//   db.findFriendsByAccountID(accountID)     → { list: { accepted, incoming, outgoing, blocked } } | null
//   db.saveFriends(accountID, data)          → void
//   db.findUsersByUsername(username)         → [ { accountID, username } ]

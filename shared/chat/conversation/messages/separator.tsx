import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {formatTimeForChat} from '@/util/timestamp'
import {SeparatorMapContext} from './ids-context'
import {usingFlashList} from '../list-area/flashlist-config'
import {OrangeLineContext} from '../orange-line-context'
import logger from '@/logger'
import {useChatDebugDump} from '@/constants/chat2/debug'

const enoughTimeBetweenMessages = (mtimestamp?: number, ptimestamp?: number): boolean =>
  !!ptimestamp && !!mtimestamp && mtimestamp - ptimestamp > 1000 * 60 * 15

// Used to decide whether to show the author for sequential messages
const authorIsCollapsible = (type?: T.Chat.MessageType) =>
  type === 'text' || type === 'deleted' || type === 'attachment'

const getUsernameToShow = (message: T.Chat.Message, pMessage: T.Chat.Message | undefined, you: string) => {
  switch (message.type) {
    case 'journeycard': // fallthrough
    case 'systemJoined':
      return ''
    case 'systemAddedToTeam':
      return message.adder
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription': // fallthrough
    case 'pin': // fallthrough
    case 'systemUsersAddedToConversation':
      return message.author
    case 'systemSBSResolved':
      return message.prover
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return message.newChannelname !== 'general' ? message.author : ''
    case 'attachment': // fallthrough
    case 'requestPayment': // fallthrough
    case 'sendPayment': // fallthrough
    case 'text':
      break
    default:
      return message.author
  }

  if (!pMessage) return message.author

  if (pMessage.author !== message.author) {
    return message.author
  }
  if (pMessage.botUsername !== message.botUsername) {
    return message.author
  }
  if (!authorIsCollapsible(message.type)) {
    return message.author
  }
  if (enoughTimeBetweenMessages(message.timestamp, pMessage.timestamp)) {
    return message.author
  }

  if (
    !(message.author || message.botUsername) ||
    !(pMessage.author || pMessage.botUsername) ||
    !message.timestamp ||
    !pMessage.timestamp
  ) {
    // something totally wrong
    logger.error('CHATDEBUG: getUsernameToShow FAILED', {
      authors: message.author === pMessage.author,
      botUsernames: message.botUsername === pMessage.botUsername,
      mcollapsible: authorIsCollapsible(message.type),
      mtime: message.timestamp,
      pcollapsible: authorIsCollapsible(pMessage.type),
      ptime: pMessage.timestamp,
    })
    return ''
  }

  return ''
}

// Author Avatar
type LProps = {
  username?: string
}
const LeftSide = React.memo(function LeftSide(p: LProps) {
  const {username} = p
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onAuthorClick = React.useCallback(() => {
    if (!username) return
    if (C.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }, [showUserProfile, showUser, username])

  return username ? (
    <Kb.Avatar
      size={32}
      username={username}
      skipBackground={true}
      onClick={onAuthorClick}
      style={styles.avatar}
    />
  ) : null
})

type TProps = {
  showUsername: string
  authorIsOwner: boolean
  authorIsAdmin: boolean
  authorIsBot: boolean
  botAlias: string
  timestamp: number
  teamType: T.Chat.TeamType
}
const TopSide = React.memo(function TopSide(p: TProps) {
  const {timestamp, botAlias, showUsername, authorIsBot, authorIsAdmin, authorIsOwner, teamType} = p
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onAuthorClick = React.useCallback(() => {
    if (C.isMobile) {
      showUsername && showUserProfile(showUsername)
    } else {
      showUsername && showUser(showUsername, true)
    }
  }, [showUser, showUsername, showUserProfile])

  const allowCrown = teamType !== 'adhoc' && (authorIsOwner || authorIsAdmin)

  const usernameNode = (
    <Kb.ConnectedUsernames
      colorBroken={true}
      colorFollowing={true}
      colorYou={true}
      onUsernameClicked={onAuthorClick}
      fixOverdraw="auto"
      type="BodySmallBold"
      usernames={showUsername}
      virtualText={true}
      className="separator-text"
    />
  )

  const ownerAdminTooltipIcon = allowCrown ? (
    <Kb.WithTooltip tooltip={authorIsOwner ? 'Owner' : 'Admin'}>
      <Kb.Icon
        color={authorIsOwner ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
        fontSize={10}
        type="iconfont-crown-owner"
      />
    </Kb.WithTooltip>
  ) : null

  const botIcon = authorIsBot ? (
    <Kb.WithTooltip tooltip="Bot">
      <Kb.Icon fontSize={13} color={Kb.Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.WithTooltip>
  ) : null

  const botAliasOrUsername = botAlias ? (
    <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1} className="separator-text">
      {botAlias} {' [' + showUsername + ']'}
    </Kb.Text>
  ) : (
    usernameNode
  )

  const canFixOverdraw = React.useContext(Kb.Styles.CanFixOverdrawContext)
  const timestampNode = (
    <Kb.Text type="BodyTiny" fixOverdraw={canFixOverdraw} virtualText={true} className="separator-text">
      {formatTimeForChat(timestamp)}
    </Kb.Text>
  )

  return (
    <Kb.Box2
      pointerEvents="box-none"
      key="author"
      direction="horizontal"
      style={styles.authorContainer}
      gap="tiny"
    >
      <Kb.Box2
        pointerEvents="box-none"
        direction="horizontal"
        gap="xtiny"
        fullWidth={true}
        style={styles.usernameCrown}
      >
        {botAliasOrUsername}
        {ownerAdminTooltipIcon}
        {botIcon}
        {timestampNode}
      </Kb.Box2>
    </Kb.Box2>
  )
})

const missingMessage = C.Chat.makeMessageDeleted({})

const useStateFast = (_trailingItem: T.Chat.Ordinal, _leadingItem: T.Chat.Ordinal) => {
  let trailingItem = _trailingItem
  let leadingItem = _leadingItem
  const sm = React.useContext(SeparatorMapContext)
  // in flat list we get the leadingItem but its the opposite of what we want
  // we derive the previous by using SeparatorMapContext
  if (!Kb.Styles.isMobile) {
    leadingItem = sm.get(trailingItem) ?? T.Chat.numberToOrdinal(0)
  } else if (!usingFlashList) {
    trailingItem = leadingItem
    leadingItem = sm.get(trailingItem) ?? T.Chat.numberToOrdinal(0)
  }
  const you = C.useCurrentUserState(s => s.username)
  const orangeOrdinal = React.useContext(OrangeLineContext)

  const TEMP = React.useRef({})

  const ret = C.useChatContext(
    C.useShallow(s => {
      const ordinal = trailingItem
      const previous = leadingItem
      const pmessage = s.messageMap.get(previous)
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const showUsername = getUsernameToShow(m, pmessage, you)
      const orangeLineAbove = orangeOrdinal === previous && previous > 0
      TEMP.current = {
        orangeOrdinal,
        ordinal,
        previous,
        showUsername,
        // eslint-disable-next-line
        mauthor: m.author,
        mbot: m.botUsername,
        mtype: m.type,
        // eslint-disable-next-line
        mtime: m.timestamp,
        pauthor: pmessage?.author,
        pbot: pmessage?.botUsername,
        ptype: pmessage?.type,
        // eslint-disable-next-line
        ptime: pmessage?.timestamp,
        // eslint-disable-next-line
        msg: (m as any).text?.stringValue?.().length,
        // eslint-disable-next-line
        pmsg: (pmessage as any)?.text?.stringValue?.().length,
      }
      return {orangeLineAbove, ordinal, showUsername}
    })
  )

  useChatDebugDump(
    `CHATDEBUGSep${trailingItem}:`,
    C.useEvent(() => {
      return JSON.stringify(TEMP.current, null, 2)
    })
  )

  return ret
}

const useState = (ordinal: T.Chat.Ordinal) => {
  const d = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const participantInfoNames = s.participants.name
      const {author, timestamp} = m
      const {teamID, botAliases, teamType, teamname} = s.meta
      // TODO not reactive
      const authorRoleInTeam = C.useTeamsState.getState().teamIDToMembers.get(teamID)?.get(author)?.type
      const authorIsOwner = authorRoleInTeam === 'owner'
      const authorIsAdmin = authorRoleInTeam === 'admin'
      const botAlias = botAliases[author] ?? ''
      const authorIsBot = teamname
        ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
        : teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
          ? !participantInfoNames.includes(author) // if adhoc, check if author in participants
          : false
      return {
        authorIsAdmin,
        authorIsBot,
        authorIsOwner,
        botAlias,
        teamType,
        timestamp,
      }
    })
  )
  return d
}

type SProps = {
  ordinal: T.Chat.Ordinal
  showUsername: string
  orangeLineAbove: boolean
}

const TopSideWrapper = React.memo(function TopSideWrapper(p: {ordinal: T.Chat.Ordinal; username: string}) {
  const {ordinal, username} = p
  const mdata = useState(ordinal)
  const {botAlias, authorIsOwner, authorIsAdmin, authorIsBot, timestamp, teamType} = mdata
  return (
    <TopSide
      showUsername={username}
      botAlias={botAlias}
      timestamp={timestamp}
      authorIsOwner={authorIsOwner}
      authorIsAdmin={authorIsAdmin}
      authorIsBot={authorIsBot}
      teamType={teamType}
    />
  )
})
const Separator = React.memo(function Separator(p: SProps) {
  const {ordinal, orangeLineAbove, showUsername} = p
  return (
    <Kb.Box2
      direction="horizontal"
      style={showUsername ? styles.container : styles.containerNoName}
      fullWidth={true}
      pointerEvents="box-none"
      className="WrapperMessage-hoverColor"
    >
      {showUsername ? <LeftSide username={showUsername} /> : null}
      {showUsername ? <TopSideWrapper username={showUsername} ordinal={ordinal} /> : null}
      {orangeLineAbove ? <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine} /> : null}
    </Kb.Box2>
  )
})

type Props = {
  leadingItem?: T.Chat.Ordinal
  trailingItem: T.Chat.Ordinal
}

const SeparatorConnector = React.memo(function SeparatorConnector(p: Props) {
  const {leadingItem, trailingItem} = p
  const {ordinal, showUsername, orangeLineAbove} = useStateFast(
    trailingItem,
    leadingItem ?? T.Chat.numberToOrdinal(0)
  )
  return ordinal && (showUsername || orangeLineAbove) ? (
    <Separator ordinal={ordinal} showUsername={showUsername} orangeLineAbove={orangeLineAbove} />
  ) : null
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          marginLeft: Kb.Styles.isMobile ? 48 : 56,
        },
        isElectron: {
          marginBottom: 0,
          marginTop: 0,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Kb.Styles.platformStyles({
        common: {position: 'absolute', top: 4},
        isElectron: {
          left: Kb.Styles.globalMargins.small,
          top: 4,
          zIndex: 2,
        },
        isMobile: {left: Kb.Styles.globalMargins.tiny},
      }),
      botAlias: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
      container: Kb.Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          height: 21,
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      containerNoName: Kb.Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      orangeLine: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.orange,
          flexShrink: 0,
          height: 1,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        isElectron: {
          // we're inside a padded container so just bust out a little
          right: -16,
        },
      }),
      usernameCrown: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
          marginRight: 48,
          position: 'relative',
          top: -2,
        },
        isMobile: {alignItems: 'center'},
      }),
    }) as const
)

export default SeparatorConnector

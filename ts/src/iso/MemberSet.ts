import SignedMessage from "./SignedMessage";

interface MemberInfo {
  // The most recent Join message
  message: SignedMessage;

  firstSeen: Date;
  lastSeen: Date;
}

// A MemberSet is a representation of the nodes that are currently in a channel.
export default class MemberSet {
  // Store the last Join message we received about this channel
  members: { [publicKey: string]: MemberInfo };

  constructor() {
    this.members = {};
  }

  handleTick() {
    let keys = Object.keys(this.members);

    // Drop anything we haven't seen in a minute
    let now = new Date();
    for (let key of keys) {
      let info = this.members[key];
      if (now.getTime() - info.lastSeen.getTime() > 60000) {
        delete this.members[key];
      }
    }
  }

  handleLeave(publicKey: string) {
    delete this.members[publicKey];
  }

  handleJoin(sm: SignedMessage) {
    let now = new Date();
    let existingInfo = this.members[sm.signer];
    this.members[sm.signer] = {
      message: sm,
      firstSeen: existingInfo ? existingInfo.firstSeen : now,
      lastSeen: now
    };
  }

  // Returns a list of Join messages for members in this group
  getJoinMessages(): SignedMessage[] {
    let answer = [];
    for (let key in this.members) {
      answer.push(this.members[key].message);
      if (answer.length >= 20) {
        break;
      }
    }
    return answer;
  }

  // Returns a list of public keys for members in this group
  getMembers(): string[] {
    let answer = [];
    let joins = this.getJoinMessages();
    for (let join of joins) {
      answer.push(join.signer);
    }
    return answer;
  }
}

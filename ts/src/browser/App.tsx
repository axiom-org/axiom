// The root to display in the sample app.

import * as React from "react";
let useState = React.useState;

import AxiomAPI from "./AxiomAPI";
import Channel from "../iso/Channel";
import Database from "../iso/Database";
import Node from "../iso/Node";
import SignedMessage from "../iso/SignedMessage";

export default function App() {
  let axiom = new AxiomAPI({ network: "alpha", verbose: true });
  let node = axiom.createNode();
  let channel = node.channel("Axboard");
  let postdb = channel.database("Posts");

  return (
    <div className="App">
      <PostList postdb={postdb} />
    </div>
  );
}

class PostList extends React.Component<
  { postdb: Database },
  { posts: { [key: string]: SignedMessage } }
> {
  postdb: Database;

  constructor(props: { postdb: Database }) {
    super(props);

    this.postdb = props.postdb;
    this.state = {
      posts: {}
    };

    setInterval(() => {
      this.postdb.load();
    }, 1000);

    this.posts.onMessage((sm: SignedMessage) => {
      if (sm.message.type === "Delete") {
        return;
      }
      let key = sm.signer + ":" + sm.message.id;
      let newPosts = { ...this.state.posts };
      newPosts[key] = sm;
      this.setState({ posts: newPosts });
    });
  }

  sortedPosts() {
    let posts = [];
    for (let key in this.state.posts) {
      comments.push(this.state.posts[key]);
    }
    comments.sort((a, b) =>
      a.message.timestamp.localeCompare(b.message.timestamp)
    );
    return comments;
  }

  render() {
    return (
      <div>
        <h1>P2P Message Board Proof Of Concept</h1>
        <InputForm database={this.postdb} />
        {this.sortedPosts().map((sm, index) => (
          <p key={index}>{sm.message.data.content}</p>
        ))}
      </div>
    );
  }
}

function InputForm(props: { database: Database }) {
  let [content, setContent] = useState("");

  let handleSubmit = e => {
    e.preventDefault();
    console.log(`submitting ${post}`);
    let data = {
      content: content
    };
    setContent("");
    props.database.create(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Post:
        <br />
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </label>
      <input type="submit" value="Submit" />
    </form>
  );
}

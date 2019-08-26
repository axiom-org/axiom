// The root to display in the sample app.

import * as React from "react";
let useState = React.useState;

import AxiomAPI from "./AxiomAPI";
import Database from "../iso/Database";
import Node from "../iso/Node";
import SignedMessage from "../iso/SignedMessage";

export default function App() {
  let axiom = new AxiomAPI({ network: "alpha", verbose: true });
  let node = axiom.createNode();
  let database = node.database("comments");

  return (
    <div className="App">
      <Chat database={database} />
    </div>
  );
}

class Chat extends React.Component<
  { database: Database },
  { comments: { [key: string]: SignedMessage } }
> {
  database: Database;

  constructor(props: { database: Database }) {
    super(props);

    this.database = props.database;
    this.state = {
      comments: {}
    };

    this.database.load();

    this.database.onMessage((sm: SignedMessage) => {
      if (sm.message.type === "Delete") {
        return;
      }
      let key = sm.signer + ":" + sm.message.id;
      let newComments = { ...this.state.comments };
      newComments[key] = sm;
      this.setState({ comments: newComments });
    });
  }

  sortedComments() {
    let comments = [];
    for (let key in this.state.comments) {
      comments.push(this.state.comments[key]);
    }
    comments.sort((a, b) =>
      a.message.timestamp.localeCompare(b.message.timestamp)
    );
    return comments;
  }

  render() {
    return (
      <div>
        <h1>P2P Chat Proof Of Concept</h1>
        <CommentForm database={this.database} />
        {this.sortedComments().map((sm, index) => (
          <p key={index}>{sm.message.comment}</p>
        ))}
      </div>
    );
  }
}

function CommentForm(props: { database: Database }) {
  let [comment, setComment] = useState("");

  let handleSubmit = e => {
    e.preventDefault();
    console.log(`submitting ${comment}`);
    setComment("");
    let data = {
      comment: e.target.value
    };
    props.database.create(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Comment:
        <br />
        <input
          type="text"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </label>
      <input type="submit" value="Submit" />
    </form>
  );
}

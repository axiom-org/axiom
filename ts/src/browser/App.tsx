// The root to display in the sample app.

import * as React from "react";

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
      let newComments = { ...comments };
      newComments[key] = sm;
      this.setState({ comments: newComments });
    });
  }

  render() {
    return (
      <div>
        <h1>P2P Chat Proof Of Concept</h1>
        <CommentForm />
        {this.state.comments.map((comment, index) => (
          <p key={index}>{comment}</p>
        ))}
      </div>
    );
  }
}

function CommentForm(props) {
  let [comment, setComment] = useState("");

  let handleSubmit = e => {
    e.preventDefault();
    alert(`submitting ${comment}`);
    setComment("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Comment:
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

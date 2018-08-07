// @flow

import * as React from 'react';
import stream from 'getstream';
import StreamAnalytics from 'stream-analytics';
import type {
  User,
  UserData,
  UserSession,
  CloudClient,
  ChildrenProps,
} from './types';

const emptySession = stream.connectCloud('', '').createUserSession('', '');

export const StreamContext = React.createContext({
  session: emptySession,
  user: emptySession.user,
  userData: undefined,
  changedUserData: () => {},
});

export type AppCtx = {
  session: UserSession,
  user: User,
  // We cannot simply take userData from user.data, since the reference to user
  // will stay the same all the time. Because of this react won't notice that
  // the internal fields changed so it thinks it doesn't need to rerender.
  userData: ?UserData,
  changedUserData: () => void,
  analyticsClient?: any,
};

type StreamAppProps = {
  appId: string,
  apiKey: string,
  token: string,
  userId: string,
  options?: {},
  analyticsToken?: string,
  defaultUserData?: UserData,
} & ChildrenProps;

type StreamAppState = AppCtx;

export class StreamApp extends React.Component<StreamAppProps, StreamAppState> {
  constructor(props: StreamAppProps) {
    super(props);
    let client: CloudClient = stream.connectCloud(
      this.props.apiKey,
      this.props.appId,
      this.props.options || {},
    );

    let session = client.createUserSession(this.props.userId, this.props.token);

    let analyticsClient;
    if (this.props.analyticsToken) {
      analyticsClient = new StreamAnalytics({
        apiKey: this.props.apiKey,
        token: this.props.analyticsToken,
      });
      analyticsClient.setUser(this.props.userId);
    }

    this.state = {
      session: session,
      user: session.user,
      userData: session.user.data,
      changedUserData: () => {
        this.setState({ userData: this.state.user.data });
      },
      analyticsClient: analyticsClient,
    };
  }

  async componentDidMount() {
    // TODO: Change this to an empty object by default
    // TODO: Maybe move this somewhere else
    await this.state.user.getOrCreate(this.props.defaultUserData || {});

    this.state.changedUserData();
  }

  render() {
    return (
      <StreamContext.Provider value={{ ...this.state }}>
        {this.props.children}
      </StreamContext.Provider>
    );
  }
}

export const StreamFeedContext = React.createContext();

type StreamFeedProps = {
  feedGroup: string,
  userId?: string,
} & ChildrenProps;

export class StreamCurrentFeed extends React.Component<StreamFeedProps> {
  render() {
    return (
      <StreamContext.Consumer>
        {(appCtx: AppCtx) => {
          const currentFeed = appCtx.session.feed(
            this.props.feedGroup,
            this.props.userId,
          );
          return (
            <StreamFeedContext.Provider value={currentFeed}>
              {this.props.children}
            </StreamFeedContext.Provider>
          );
        }}
      </StreamContext.Consumer>
    );
  }
}
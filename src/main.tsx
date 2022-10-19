import 'antd/dist/antd.css';
import React, {useEffect, useState} from 'react';
import {Button, Form, Input, message, Select} from 'antd';
import localforage from 'localforage';
import RingCentral from '@rc-ex/core';
import {Inviter, SessionState, UserAgent, Registerer} from 'sip.js';

class LoginForm {
  serverUrl!: string;
  clientId!: string;
  clientSecret!: string;
  username!: string;
  extension?: string;
  password!: string;
}

let rc: RingCentral;
let loginForm: LoginForm;
const remoteVideoElement = document.getElementById(
  'remote-video'
) as HTMLVideoElement;
const localVideoElement = document.getElementById(
  'local-video'
) as HTMLVideoElement;

const App = () => {
  const login = async (_loginForm: LoginForm) => {
    loginForm = _loginForm;
    await localforage.setItem('wp-login-form', loginForm);
    rc = new RingCentral({
      server: loginForm.serverUrl,
      clientId: loginForm.clientId,
      clientSecret: loginForm.clientSecret,
    });
    await rc.authorize({
      username: loginForm.username,
      extension: loginForm.extension,
      password: loginForm.password,
    });
    message.success('You have logged in!');
    setLoggedIn(true);
    await postLogin();
  };

  const logout = () => {
    setLoggedIn(false);
    if (rc !== undefined) {
      rc.revoke();
    }
    message.success('You have logged out!');
  };

  const postLogin = async () => {
    const r = await rc
      .restapi()
      .clientInfo()
      .sipProvision()
      .post({
        sipInfo: [
          {
            transport: 'WSS',
          },
        ],
      });
    const sipInfo = r.sipInfo![0];
    console.log(JSON.stringify(sipInfo, null, 2));

    // Create user agent instance (caller)
    const userAgent = new UserAgent({
      uri: UserAgent.makeURI(`sip:${sipInfo.username}@${sipInfo.domain}`),
      transportOptions: {
        server: `wss://${sipInfo.outboundProxy}`,
      },
      authorizationUsername: sipInfo.authorizationId,
      authorizationPassword: sipInfo.password,
    });

    // Connect the user agent
    await userAgent.start();
    // Set target destination (callee)
    const target = UserAgent.makeURI(`sip:16506417402@${sipInfo.domain}`);
    if (!target) {
      throw new Error('Failed to create target URI.');
    }

    const registerer = new Registerer(userAgent);
    await registerer.register();

    // Create a user agent client to establish a session
    const inviter = new Inviter(userAgent, target, {
      sessionDescriptionHandlerOptions: {
        constraints: {audio: true, video: false},
      },
    });

    // Handle outgoing session state changes
    inviter.stateChange.addListener(newState => {
      switch (newState) {
        case SessionState.Establishing:
          // Session is establishing
          break;
        case SessionState.Established:
          // Session has been established
          break;
        case SessionState.Terminated:
          // Session has terminated
          break;
        default:
          break;
      }
    });

    // Send initial INVITE request
    await inviter.invite();
  };

  const [form] = Form.useForm();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const loginForm = await localforage.getItem('wp-login-form');
      form.setFieldsValue(loginForm);
    })();
  });

  return (
    <>
      <h1>RingCentral Web Phone Demo</h1>
      {loggedIn ? (
        <>
          <video id="remote-video" hidden></video>
          <video id="local-video" hidden muted></video>
          <Button onClick={logout}>Log out</Button>
        </>
      ) : (
        <Form
          name="basic"
          labelCol={{span: 8}}
          wrapperCol={{span: 8}}
          onFinish={login}
          autoComplete="off"
          form={form}
        >
          <Form.Item
            label="Server URL"
            name="serverUrl"
            rules={[{required: true, message: 'Please input the Server URL!'}]}
          >
            <Select>
              <Select.Option value="https://platform.ringcentral.com">
                https://platform.ringcentral.com
              </Select.Option>
              <Select.Option value="https://platform.devtest.ringcentral.com">
                https://platform.devtest.ringcentral.com
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Client Id"
            name="clientId"
            rules={[{required: true, message: 'Please input the Client Id!'}]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Client Secret"
            name="clientSecret"
            rules={[
              {required: true, message: 'Please input the Client Secret!'},
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Username"
            name="username"
            rules={[{required: true, message: 'Please input the Username!'}]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Extension" name="extension">
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{required: true, message: 'Please input the Password!'}]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item wrapperCol={{offset: 8, span: 8}}>
            <Button type="primary" htmlType="submit">
              Login
            </Button>
          </Form.Item>
        </Form>
      )}
    </>
  );
};

export default App;

import scrumBoard from './undraw_scrum_board_cesn.svg';
import moment from 'moment';
import axios from 'axios';
import React, { Component } from 'react';
import 'antd/dist/antd.css'; 
import './App.css';
import DatePicker from 'antd/lib/date-picker';
import { Layout, Menu, Row, Col, Card, Spin, Input, Button, TreeSelect, message } from 'antd';
const { Header, Content, Footer } = Layout;
const { WeekPicker } = DatePicker;

class App extends Component {
  constructor(props) {
    super(props);
    const initialState = {
      token: '',
      userEmail: '',
      apiUrl: 'https://clarisoft.atlassian.net',
      startDate: moment().day("Monday"),
      loading: false,
      items: [],
      users: [],
      selectedUsers: [],
      projects: [],
      selectedProjects: [],
      issues: [],
      mappedWorklogs: {},
    };

    const token = localStorage.getItem('jiraToken');
    const userEmail = localStorage.getItem('userEmail');
    if(token && userEmail) {
      initialState.token = token;
      initialState.userEmail = userEmail;
      initialState.loading = false;
    }
    this.state = initialState;
  }

  async componentDidMount() {
    const { token, userEmail } = this.state;
    if( !token || !userEmail) {
      return;
    }

    /* try {
      const users = await axios.get(`/rest/api/latest/user/search?username=%`, {
        auth: {
          username: userEmail,
          password: token
        }
      });

      const mappedUsers = (users.data || []).map(item => ({
        title: item.displayName,
        value: item.name,
        key: item.name,
      }))

      this.setState({
        users: mappedUsers,
      });

      console.log('componentDidMount users ', users, token, userEmail);
    }catch(error){

    }*/

    try {
      const projects = await axios.get(`/rest/api/latest/project`, {
        auth: {
          username: userEmail,
          password: token
        }
      });

      const mappedProjects = (projects.data || []).map(item => ({
        title: item.name,
        value: item.id,
        key: item.id,
      }))

      this.setState({
        projects: mappedProjects,
      });
    }catch(error){

    }

  }

  onChangeDate = (value) => {
    this.setState({
      startDate: value,
    });
  }

  onTokenChange = (event) => {
    this.setState({
      token: event.target.value,
    });
  }

  onApiUrlChange = (event) => {
    this.setState({
      apiUrl: event.target.value,
    });
  }

  onEmailChange = (event) => {
    this.setState({
      userEmail: event.target.value,
    });
  }

  onSaveSettings = () => {
    localStorage.setItem('jiraToken', this.state.token);
    localStorage.setItem('userEmail', this.state.userEmail);
    window.location.reload();
  }

  onSearch = async () => {
    localStorage.setItem('jiraToken', this.state.token);
    localStorage.setItem('userEmail', this.state.userEmail);

    const { selectedProjects } = this.state;

    if(selectedProjects.length === 0){
      message.error('Please select at least a project first');
      return;
    }

    this.setState({
      loading: true,
    });

    const { startDate } = this.state;

    const from = startDate.day("Monday").format('YYYY/MM/DD');
    const to = startDate.day("Saturday").add(1, 'day').format('YYYY/MM/DD');

    try {
      const projectCondition = ` AND project in (${selectedProjects.join()}) `;
      const issues = await axios.get(`/rest/api/latest/search?jql=updated>="${from}" ${projectCondition} &maxResults=100`, {
        auth: {
          username: this.state.userEmail,
          password: this.state.token
        }
      });

      let mappedIssues = (issues.data.issues || []).map(issue => ({
        key: issue.key,
        id: issue.id,
        projectId: issue.fields.project.id,
        projectName: issue.fields.project.name,
      }));

      let numberOfResults = issues.data.maxResults;
      let totalNumberOfResults = issues.data.total;
      while(numberOfResults < totalNumberOfResults) {
        const issuesPage = await axios.get(`/rest/api/latest/search?jql=updated>="${from}" ${projectCondition} &maxResults=100&startAt=${numberOfResults+1}`, {
          auth: {
            username: this.state.userEmail,
            password: this.state.token
          }
        });

        let mappedIssuesPage = (issuesPage.data.issues || []).map(issue => ({
          key: issue.key,
          id: issue.id,
          projectId: issue.fields.project.id,
          projectName: issue.fields.project.name,
        }));

        mappedIssues = [...mappedIssues, ...mappedIssuesPage];
        numberOfResults += issuesPage.data.maxResults;
      }

      this.setState({
        issues: mappedIssues,
      });

      let worklogs = []
      for(let i = 0; i < mappedIssues.length; i++){
        const issue = mappedIssues[i];
        const issueWorklogs = await axios.get(`/rest/api/latest/issue/${issue.id}/worklog?jql=started>="${from}" AND started<="${to}"&maxResults=100`, {
          auth: {
            username: this.state.userEmail,
            password: this.state.token
          }
        });

        const newWorklogs = issueWorklogs.data.worklogs.map(worklog => ({
          issueKey: issue.key,
          issueId: issue.id,
          projectId: issue.projectId,
          projectName: issue.projectName,
          author: worklog.author.name,
          timeSpent: worklog.timeSpent,
          id: worklog.id,
          timeSpentSeconds: worklog.timeSpentSeconds,
          started: worklog.started,
          startedDayOfWeek: moment(worklog.started).format('dddd'),
        }));

        worklogs = [...worklogs, newWorklogs];
      }

      worklogs = worklogs.flat();

      const users = worklogs.map(x => x.author).filter((v, i, a) => a.indexOf(v) === i); 
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      const mappedWorklogs = {};

      for(let i = 0; i < users.length; i++){
        const user = users[i];

        mappedWorklogs[user] = [];

        const issues = worklogs
          .filter(x => x.author === user)
          .map(x => x.issueKey)
          .filter((v, i, a) => a.indexOf(v) === i);

        for(let j = 0; j < issues.length; j++){
          const issueKey = issues[j];

          const mappedIssue = {
            issueKey,
            Monday: '-',
            Tuesday: '-',
            Wednesday: '-',
            Thursday: '-',
            Friday: '-',
            Saturday: '-',
            Sunday: '-',
          };

          for(let k = 0; k < weekDays.length; k++) {
            const weekDay = weekDays[k];

            const worklogInSeconds = worklogs
              .filter(x => x.author === user && x.issueKey === issueKey && x.startedDayOfWeek === weekDay)
              .map(x => x.timeSpentSeconds)
              .reduce((total, current) => total + current, 0);
            
              mappedIssue[weekDay] = moment.utc(worklogInSeconds*1000).format('HH:mm');
          }

          mappedWorklogs[user].push(mappedIssue);
        }
      }

      console.log('onSearch worklogs', mappedWorklogs, worklogs);
      this.setState({
        mappedWorklogs
      });
    }catch(error){
      console.log('onSearch error', error);
    }finally{
      this.setState({
        loading: false,
      });
    }
  }

  selectedUsersChange = (value) => {
    this.setState({
      selectedUsers: value
    });
  }

  selectedProjectsChange = (value) => {
    this.setState({
      selectedProjects: value
    });
  }

  renderTable() {
    const { mappedWorklogs } = this.state;
    return (
      <div>
        {
          Object.keys(mappedWorklogs).map(key => {
            const userWorklogs = mappedWorklogs[key];

            return (
              <React.Fragment>
              <Row type="flex">
                <Col span={3}>
                  Issue
                </Col>
                <Col span={3}>
                  Monday
                </Col>
                <Col span={3}>
                  Tuesday
                </Col>
                <Col span={3}>
                  Wednesday
                </Col>
                <Col span={3}>
                  Thursday
                </Col>
                <Col span={3}>
                  Friday
                </Col>
                <Col span={3}>
                  Saturday
                </Col>
                <Col span={3}>
                  Sunday
                </Col>
              </Row>
              <Row type="flex">
                <Col span={24}>
                  {key}
                </Col>
              </Row>
              {
                userWorklogs.map(worklog => {
                  return (
                    <Row type="flex">
                      <Col span={3}>
                        {worklog['issueKey']}
                      </Col>
                      <Col span={3}>
                        {worklog['Monday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Tuesday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Wednesday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Thursday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Friday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Saturday']}
                      </Col>
                      <Col span={3}>
                        {worklog['Sunday']}
                      </Col>
                    </Row>
                  )
                })
              }
              </React.Fragment>
            )
          })
        }
      </div>
    )
  }

  render() {
    const { loading, token, startDate, items, apiUrl, userEmail, users, selectedUsers, projects, selectedProjects, mappedWorklogs } = this.state;
    const noResults = Object.keys(mappedWorklogs).length === 0;

    /* const tUsersProps = {
      treeData: users,
      value: selectedUsers,
      onChange: this.selectedUsersChange,
      treeCheckable: true,
      showCheckedStrategy: TreeSelect.SHOW_PARENT,
      searchPlaceholder: 'All users selected',
      style: {
        width: '100%',
      },
    }; */

    const tProjectProps = {
      treeData: projects,
      value: selectedProjects,
      onChange: this.selectedProjectsChange,
      treeCheckable: true,
      showCheckedStrategy: TreeSelect.SHOW_PARENT,
      searchPlaceholder: 'All projects selected',
      style: {
        width: '100%',
      },
    };

    return (
      <Layout className="layout">
        <Header>
          <Menu
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={['1']}
            style={{ lineHeight: '64px' }}
          >
            <Menu.Item key="1">Jira timesheet</Menu.Item>
          </Menu>
        </Header>
        <Content style={{ padding: '50px 50px' }}>
          <Row type="flex" justify="center">
            <Col span={12}>
              <Card title="Settings" bordered={false}>
                <Row type="flex" justify="center">
                  <Col span={6}>
                    <Input
                      onChange={this.onApiUrlChange}
                      value={apiUrl}
                      disabled={loading}
                      addonBefore="Url" />
                  </Col>
                  <Col span={6}>
                    <Input
                      onChange={this.onEmailChange}
                      value={userEmail}
                      disabled={loading}
                      addonBefore="Email" />
                  </Col>
                  <Col span={6}>
                    <Input
                      onChange={this.onTokenChange}
                      value={token}
                      disabled={loading}
                      addonBefore="Token" />
                  </Col>
                  <Col span={3}>
                    <Button
                      onClick={this.onSaveSettings}
                      disabled={loading}
                      type="primary" icon="save">
                      Save
                    </Button>
                  </Col>
                </Row>
                <Row type="flex" justify="center" className="top-padding">
                  <Col span={4}>
                    <WeekPicker
                      onChange={this.onChangeDate}
                      value={startDate}
                      disabled={loading}
                      placeholder="Select week" />
                  </Col>
                  <Col span={12}>
                    <TreeSelect {...tProjectProps} />
                  </Col>
                  <Col span={3}>
                    <Button
                      onClick={this.onSearch}
                      disabled={loading}
                      type="primary" icon="search">
                      Search
                    </Button>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
          <Row type="flex" justify="center" className="top-padding">
            <Col span={12}>
              <Card title="Timesheets" bordered={false}>
              { loading &&              
                <Col span={24} type="flex" justify="center">
                  <Row type="flex" justify="center">
                    Loading timesheets <Spin style={{ paddingLeft: '10px' }} />                  
                  </Row>
                </Col>
              }
              { (!loading && noResults) &&              
                <Col span={24} type="flex" justify="center">
                  <Row type="flex" justify="center">
                    No timesheets found            
                  </Row>
                </Col>
              }
              {
                (loading || noResults) &&
                <Col span={24}>
                  <Row type="flex" justify="center">
                    <Col span={12}>
                      <img src={scrumBoard} width="100%" alt="People looking at a timesheet" />
                    </Col>
                  </Row>
                </Col>
              }
              {
                (!loading && !noResults) &&
                <Col span={24}>
                  {this.renderTable()}
                </Col>
              }
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    );
  }
}

export default App;

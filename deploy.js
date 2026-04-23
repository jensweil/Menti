import FtpDeploy from 'ftp-deploy';
const ftpDeploy = new FtpDeploy();

const config = {
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  host: process.env.FTP_HOST,
  port: 21,
  localRoot: './dist',
  remoteRoot: process.env.FTP_DESTINATION || '/public_html/',
  include: ['*', '**/*'],
  deleteRemote: false,
  forcePasv: true,
};

console.log('🚀 Starting deployment to Hostinger...');

ftpDeploy
  .deploy(config)
  .then((res) => console.log('✅ Deployment finished:', res))
  .catch((err) => console.error('❌ Deployment error:', err));

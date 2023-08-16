# 前提
以下 Power Apps から App Configuration 上のキーバリューにセキュアアクセスするシナリオを実現する為のステップバイステップガイドを提供します。

![00](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/ff9988a7-4061-4832-842e-8b986abb1e4b)

本シナリオで想定しているフローは以下の通りです。

1. Power Apps アプリ上で２つの値(App Configuration構成ストアの”キー”と”ラベル”を指定し、ボタン押下アクションを実行し、Power Automate を開始する。
2. Power Automate から認証ポリシーで保護された Logic Apps フローを実行試行し、Power Automate HTTP アクションに設定した Entra ID アプリケーション情報が認証ポリシーと合致すれば、Logic Apps フローがパラメーター指定され開始する。
3. Logic Apps から Function App を実行試行し、Function に設定された認証設定／プロバイダー情報に Logic Apps に設定された Managed Identities 情報と合致すれば、Function App がパラメーター指定され開始する。
4. Function App が App Configuration に接続試行を行い、Function に設定された Managed Identities の RBAC 設定が App Configuration に設定されていれば、App Configuration からのバリュー取得試行を行う。
5. パラメーター指定されたキー／ラベルを元にバリューがFunction App に返され、同じく HTTP アクション実行後の Body を待機する Logic Apps／Power Automate に返され、最終的に Power Apps の ReturnBody 変数に格納される。

上記シナリオはユーザーインターフェース上での実行～ユーザーインターフェース上への値の応答までをエンド・ツー・エンドで実現する為のものですが、実際は Logic Apps のパラメーターとして利用する等、要件に応じて実装対象を検討します。


# 構成に必要な設定値一覧
以下構成手順を進めて頂く中で設定／収集する設定値一覧テーブルです。

煩雑になりがちですのでお手元のメモ代わりにご利用下さい。

| 設定名 | 例 | 設定値 | 備考 |
| ------------- | ------------- | ------------- | ------------- |
| `Memo.DirectoryID` | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx| | Azure AD テナントID |
| `Memo.AppConf.Endpoint` | https://xxx.azconfig.io| | App Configuration のエンドポイント値 |
| `Memo.Func.ManagedID` | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx| | Function App のシステム割り当てマネージドIDのオブジェクトID |
| `Memo.LA.ManagedID` | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx| | Logic App のシステム割り当てマネージドIDのオブジェクトID |
| `Memo.LA.EntraApp.ID` | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx| | Logic App 認証用のEntra ID アプリのアプリケーションID |
| `Memo.LA.EntraApp.URI` | api:sample-api| | Logic App 認証用のEntra ID アプリのAPI URI |
| `Memo.PA.EntraApp.ID` | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx| | Power Automate 認証用のEntra ID アプリのアプリケーションID |
| `Memo.PA.EntraApp.SC` | XxxxxxxXXXxxxxxxxxxx| | Power Automate 認証用のEntra ID アプリのシークレット |
| `Memo.LA.POSTURL` | https://xxx.logic.azure.com~api-version=2016-10-01 | | Logic App HTTP コール用URL |

# 構成手順
## リソースの作成
### App Configuration リソースの作成
a. Azure ポータルから以下設定値で App Configuration リソースを作成します。

![01](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/f8582022-7142-45c9-83c0-1e83db0dcf59)

| 設定名 | 設定値 |
| ------------- | ------------- |
| Subscription | リソースを作成するサブスクリプションを指定 |
| Resource Group | リソースを作成するリソースグループを指定、もしくは新規作成 |
| Location | リソースを作成するリージョンを指定 |
| Resource Name | 任意のアプリ識別名を入力 |
| Pricing Tier | Free |

b. Endpoint値をMemo.AppConf.Endpointとしてメモします。

![02](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/381cdd44-f63e-43d8-aeb2-c28d64d3d4e3)


[サインアップとサインインユーザーフローを作成する](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/add-sign-up-and-sign-in-policy?pivots=b2c-user-flow)

### 3. B2C テナントへの Azure AD アプリケーション登録
#### 3-1. Web API 用アプリケーションの登録
Web API 用アプリケーションを登録し、APIスコープを構成します。

[Web API アプリケーションを登録する](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/configure-authentication-sample-spa-app#step-21-register-the-web-api-application)
[スコープを構成する](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/configure-authentication-sample-spa-app#step-22-configure-scopes)

#### 3-2. SPA 用アプリケーションの登録
SPA 用アプリケーションを登録します。

[SPA を登録する](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/configure-authentication-sample-spa-app#step-23-register-the-spa)

## リソース展開
以下ボタンをクリック頂くとお持ちの Azure サブスクリプションにリソースが自動作成されます。

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FTK3214-MS%2FPOC-AUTH%2Fmain%2Fbicep%2Fmain.json)

設定頂くパラメーターは以下の通りです。

- Region：リソースを展開するリージョンを指定します。
- Prefix：作成されるリソースのプレフィックスを指定します。（小文字英字のみ）
- Location：指定頂く必要はありません。
- Administrator User Name：Azure SQL Databaseで利用する管理者ユーザー名を指定します。
- Administrator User Email：Azure SQL Databaseで利用する管理者ユーザーメールアドレスを指定します。
- Administrator Login Password：Azure SQL Databaseで利用する管理者ユーザーパスワードを指定します。

## 展開後構成
### 1. Azure Functions へのインバウンドポリシーの設定
Azure Functions の API Management ブレードから Inbound Processing Policy を作成します。

![Inbound Policy](https://github.com/TK3214-MS/POC-AUTH/assets/89323076/4371bb63-76ee-4542-aedd-d477b267106c)

今回作成するのは以下ポリシーです。完成したポリシー XML を元に構成します。

- cors
```
<policies>
    <inbound>
        <cors allow-credentials="false">
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods preflight-result-max-age="120">
                <method>GET</method>
                <method>POST</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
            <expose-headers>
                <header>*</header>
            </expose-headers>
        </cors>
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized. Access token is missing or invalid." require-expiration-time="true" require-signed-tokens="true" clock-skew="300">
            <openid-config url="https://[B2C テナント名].b2clogin.com/[B2C テナント名].onmicrosoft.com/v2.0/.well-known/openid-configuration?p=[B2Cサインアップ／サインインポリシー名]" />
            <required-claims>
                <claim name="aud">
                    <value>[Web API 用 Azure AD B2C登録アプリのクライアントID]</value>
                </claim>
            </required-claims>
        </validate-jwt>
        <rate-limit-by-key calls="300" renewal-period="120" counter-key="@(context.Request.IpAddress)" />
        <rate-limit-by-key calls="15" renewal-period="60" counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","").AsJwt()?.Subject)" />
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```
- validate-jwt
```
<policies>
    <inbound>
        <cors allow-credentials="false">
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods preflight-result-max-age="120">
                <method>GET</method>
                <method>POST</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
            <expose-headers>
                <header>*</header>
            </expose-headers>
        </cors>
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized. Access token is missing or invalid." require-expiration-time="true" require-signed-tokens="true" clock-skew="300">
            <openid-config url="https://[B2C テナント名].b2clogin.com/[B2C テナント名].onmicrosoft.com/v2.0/.well-known/openid-configuration?p=[B2Cサインアップ／サインインポリシー名]" />
            <required-claims>
                <claim name="aud">
                    <value>[Web API 用 Azure AD B2C登録アプリのクライアントID]</value>
                </claim>
            </required-claims>
        </validate-jwt>
        <rate-limit-by-key calls="300" renewal-period="120" counter-key="@(context.Request.IpAddress)" />
        <rate-limit-by-key calls="15" renewal-period="60" counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","").AsJwt()?.Subject)" />
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```
- rate-limit-by-key
```
<policies>
    <inbound>
        <cors allow-credentials="false">
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods preflight-result-max-age="120">
                <method>GET</method>
                <method>POST</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
            <expose-headers>
                <header>*</header>
            </expose-headers>
        </cors>
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized. Access token is missing or invalid." require-expiration-time="true" require-signed-tokens="true" clock-skew="300">
            <openid-config url="https://**[B2C テナント名]**.b2clogin.com/[B2C テナント名].onmicrosoft.com/v2.0/.well-known/openid-configuration?p=[B2Cサインアップ／サインインポリシー名]" />
            <required-claims>
                <claim name="aud">
                    <value>[Web API 用 Azure AD B2C登録アプリのクライアントID]</value>
                </claim>
            </required-claims>
        </validate-jwt>
        <rate-limit-by-key calls="300" renewal-period="120" counter-key="@(context.Request.IpAddress)" />
        <rate-limit-by-key calls="15" renewal-period="60" counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","").AsJwt()?.Subject)" />
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

### 2. Azure Functions への認証設定
Azure Functions の認証ブレードから Azure AD B2C で登録した Web API 用アプリケーションのクライアントIDを設定します。

![Function Authentication](https://github.com/TK3214-MS/POC-AUTH/assets/89323076/b23efedd-9f55-4e88-9bfb-49efed525d20)

### 3. ソースコードのプッシュ
スースコードのプッシュに進む前に軽微な修正を行います。

#### Static Web Apps
- frontend/SPA/src/authConfig.js

```
import { LogLevel } from "@azure/msal-browser";

export const b2cPolicies = {
    names: {
        signUpSignIn: '[Azure AD B2C サインアップ／サインインポリシー名]',
    },
    authorities: {
        signUpSignIn: {
            authority: 'https://[Azure AD B2C テナント名].b2clogin.com/[Azure AD B2C テナント名].onmicrosoft.com/[Azure AD B2C サインアップ／サインインポリシー名]',
        },
    },
    authorityDomain: '[Azure AD B2C テナント名].b2clogin.com',
};

export const msalConfig = {
    auth: {
        clientId: '[SPA用 Azure AD B2C 登録アプリのクライアントID]', // This is the ONLY mandatory field that you need to supply.
        authority: b2cPolicies.authorities.signUpSignIn.authority, // Choose SUSI as your default authority.
        knownAuthorities: [b2cPolicies.authorityDomain], // Mark your B2C tenant's domain as trusted.
        redirectUri: '/', // You must register this URI on Azure Portal/App Registration. Defaults to window.location.origin
        postLogoutRedirectUri: '/', // Indicates the page to navigate after logout.
        navigateToLoginRequestUrl: false, // If "true", will navigate back to the original request location before processing the auth code response.
    },
    cache: {
        cacheLocation: 'sessionStorage', // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            },
        },
    },
};

/**
 * Add here the endpoints and scopes when obtaining an access token for protected web APIs. For more information, see:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const protectedResources = {
    apiTodoList: {
        endpoint: 'https://[API Management リソース名].azure-api.net/[Azure Functions リソース名]/HttpTriggerFunction',
        scopes: {
            read: ['https://[Azure AD B2C テナント名].onmicrosoft.com/[APIディレクトリ名]/Text.Read']
        }
    },
};

export const loginRequest = {
    scopes: [...protectedResources.apiTodoList.scopes.read],
};
```

#### Azure Functions
- api-function/HttpTriggerFunction/index.ts

```
import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as sql from "mssql";

const config = {
  server: "[Azure SQL Server FQDN]",
  database: "[Azure SQL Database 名]",
  authentication: {
    type: "azure-active-directory-msi-app-service",
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};
```

以下を参考に Static Web Apps、並びに Azure Functions へソースコードをプッシュします。

[Azure Function Apps へのデプロイ](https://learn.microsoft.com/en-us/azure/azure-functions/functions-develop-vs-code?tabs=csharp)
[Static Web Apps へのデプロイ](https://learn.microsoft.com/ja-jp/azure/static-web-apps/getting-started?tabs=vanilla-javascript)

### 4. Azure SQL Database への Azure Functions 認証の設定
[SQL Server Management Studio](https://learn.microsoft.com/ja-jp/sql/ssms/download-sql-server-management-studio-ssms?view=sql-server-ver16)より Azure SQL Server へ接続し、以下クエリを実行する事でデータベースへのアクセス権限を Azure Functions サービスプリンシパルに付与します。

```
CREATE USER [Azure Functions App のリソース名] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [Azure Functions App のリソース名];
ALTER ROLE db_datawriter ADD MEMBER [Azure Functions App のリソース名];
GO
```

### 5. Azure SQL Database へのサンプルテーブル作成
[SQL Server Management Studio](https://learn.microsoft.com/ja-jp/sql/ssms/download-sql-server-management-studio-ssms?view=sql-server-ver16)より Azure SQL Server へ接続し、以下クエリを実行する事でテキスト値挿入用のサンプルテーブルを作成します。

```
CREATE TABLE dbo.SampleTable (
    InputText NVARCHAR(MAX) COLLATE Japanese_CI_AS NOT NULL,
    CreatedAt DATETIME NOT NULL,
);
```

## 動作確認 - SPA 編
作成した Single Page Application 上の操作を通して全体構成を確認します。

### 1. Static Web Apps の URL へアクセス
[デモライブサイト](https://brave-grass-055a2a000.3.azurestaticapps.net)へモダンブラウザー（Microsoft EdgeやGoogle Chrome等）でアクセスします。

### 2. ユーザーサインアップ
画面右上の Sign in ボタンをクリックし、Sign in with Redirect を選択します。
Sign up をクリックし、ユーザーサインアップ（Azure AD B2C テナントへのユーザー作成）を行います。

![User Details](https://github.com/TK3214-MS/POC-AUTH/assets/89323076/63874829-b568-4767-a122-a7414a8fbbd3)

正常にサインインが完了すると Azure AD B2C テナントから払い出された ID トークン内のクレーム値一覧が表示されます。

![Claims](https://github.com/TK3214-MS/POC-AUTH/assets/89323076/25bbdaeb-8672-43c7-9beb-f230d0323d40)

### 3. データベースからのテキスト値 GET/POST 動作確認
画面上部にある Text Input ボタンをクリックし、適当なテキスト値を入力し送信ボタンをクリックします。

![Insert](https://github.com/TK3214-MS/POC-AUTH/assets/89323076/77c5b2b5-e4a4-4733-9f38-f67bcde06163)

## 動作確認 - API 編
パブリッククライアントから Web API 直接キックシナリオを想定して認証フローを確認します。
今回のフローで用いられているのは [OAuth 2.0 承認コードフロー](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/authorization-code-flow) と呼ばれるものです。

### 1. 承認コードの取得
モダンブラウザで以下 URL へアクセスします。

```
https://[Azure AD B2C テナント名].b2clogin.com/[Azure AD B2C テナント名].onmicrosoft.com/oauth2/v2.0/authorize?p=[Azure AD B2C サインアップ／サインインポリシー名]&client_id=[Web API 用 Azure AD B2C登録アプリのクライアントID]&response_type=code&redirect_uri=https://jwt.ms&response_mode=query&scope=https%3A%2F%2F[Azure AD B2C テナント名].onmicrosoft.com%2Fapiv2%2Fread&state=anything&prompt=login
```

### 2. アクセストークンの取得
HTTP クライアント（Postman等）で以下要求を行います。

```
POST https://[Azure AD B2C テナント名].b2clogin.com/[Azure AD B2C テナント名].onmicrosoft.com/oauth2/v2.0/token?p=[Azure AD B2C サインアップ／サインインポリシー名]&client_id=[Web API 用 Azure AD B2C登録アプリのクライアントID]&client_secret=[Web API 用 Azure AD B2C登録アプリのクライアントシークレット]&scope=https%3A%2F%2F[Azure AD B2C テナント名].onmicrosoft.com%2Fapiv2%2Fread&redirect_uri=https://jwt.ms&grant_type=authorization_code&code=[STEP1で取得した承認コード]
```

### 3. アクセストークンを用いた API テスト
Azure API Management Gateway URL に対して Authorization Bearer トークン認証付きで HTTP クライアントから要求を行い、ステータス 200 が返ってくれば動作確認完了です。

## Azure リソースとコスト
本サンプルワークロードを展開されますと以下リソースが展開されます。

- API Management
- Azure Functions
- Azure SQL Server
- Azure SQL Database
- Azure AD B2C

月間コスト見積は以下からご確認可能です。

[Azure 料金計算ツール](https://azure.com/e/62ca9695ff144a71acf0139e2e34d6fc)  
※月額フル稼働させた場合：約 7,200 円  
※1時間程度の動作確認をした場合：約 10 円  

## リソース
[SPA から使用される Azure API Management と Azure AD B2C によってサーバーレス API を保護する](https://learn.microsoft.com/ja-jp/azure/api-management/howto-protect-backend-frontend-azure-ad-b2c)

[Azure Active Directory B2C を使用してサンプルの React シングルページ アプリケーションで認証を構成する](https://learn.microsoft.com/ja-jp/azure/active-directory-b2c/configure-authentication-sample-react-spa-app)
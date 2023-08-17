# 目次
- [前提](#前提)
- [構成に必要な設定値一覧](#構成に必要な設定値一覧)
- [構成手順](#構成手順)
  - [リソースの作成](#リソースの作成)
    - [App Configuration リソースの作成](#app-configuration-リソースの作成)
    - [Functions リソースの作成](#functions-リソースの作成)
    - [Logic Apps リソースの作成](#logic-apps-リソースの作成)
  - [App Configuration／Function App 間の保護](#app-configuration／function-app間の保護)
    - [App Configuration への RBAC 設定](#app-configuration-への-rbac-設定)
  - [Function App／Logic Apps 間の保護](#function-app／logic-apps間の保護)
    - [Function App への認証設定](#function-app-への認証設定)
  - [Logic Apps／Power Automate 間の保護](#logic-apps／power-automate間の保護)
    - [Logic Apps 認証用 Entra ID アプリ作成](#logic-apps-認証用-entra-id-アプリ作成)
    - [Power Automate 認証用 Entra ID アプリ作成](#power-automate-認証用-entra-id-アプリ作成)
    - [Logic Apps への認証ポリシー構成](#logic-apps-への認証ポリシー構成)
  - [Function App へのアプリ展開](#function-appへのアプリ展開)
    - [Visual Studio Code からの Function プロジェクトの展開](#visual-studio-code-からの-function-プロジェクトの展開)
  - [Logic Apps フローの作成](#logic-apps-フローの作成)
  - [Power Automate フローの作成](#power-automateフローの作成)
  - [Power Apps アプリの作成](#power-apps-アプリの作成)
- [参考情報](#参考情報)

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
| `Subscription` | リソースを作成するサブスクリプションを指定 |
| `Resource Group` | リソースを作成するリソースグループを指定、もしくは新規作成 |
| `Location` | リソースを作成するリージョンを指定 |
| `Resource Name` | 任意のアプリ識別名を入力 |
| `Pricing Tier` | Free |

b. Endpoint値を`Memo.AppConf.Endpoint`としてメモします。

![02](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/381cdd44-f63e-43d8-aeb2-c28d64d3d4e3)

### Functions リソースの作成
a. Azure ポータルから以下設定値でFunctions リソースを作成します。

![03](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/54f68d25-1f3e-494e-86b1-553348566356)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Subscription` | リソースを作成するサブスクリプションを指定 |
| `Resource Group` | リソースを作成するリソースグループを指定、もしくは新規作成 |
| `Function App Name` | 任意のアプリ識別名を入力 |
| `Code or Container` | Code |
| `Runtime stack` | Node.js |
| `Version` | 18 LTS |
| `Region` | リソースを作成するリージョンを指定 |
| `Operating System` | Windows |
| `Hosting` | Consumption |

b. Node.jsアプリで参照するアプリケーション設定を追加します。

![04](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/934ae456-f92b-443b-8d35-8f9dab6402fd)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `AZURE_APPCONFIG_ENDPOINT` | `Memo.AppConf.Endpoint` |

c. システム割り当てマネージドIDを有効化し、`Memo.Func.ManagedID`としてObject IDをメモします。

![05](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/599beed4-da97-4f69-8717-5c30c9a0f93a)

### Logic Apps リソースの作成
a. Azureポータルから以下設定値でLogic Appsリソースを作成します。

![06](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/6e9ed9c5-f468-456d-a0fd-7e747075c453)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Subscription` | リソースを作成するサブスクリプションを指定 |
| `Resource Group` | リソースを作成するリソースグループを指定、もしくは新規作成 |
| `Logic App name` | 任意のアプリ識別名を入力 |
| `Region` | リソースを作成するリージョンを指定 |
| `Enable Log Analytics` | No |
| `Plan type` | Consumption |

b. システム割り当てマネージドIDを有効化し、`Memo.LA.ManagedID`としてObject IDをメモします。

![07](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/23b01658-5a4a-4598-8bf4-f078264e97a9)

## App Configuration／Function App間の保護
### App Configuration への RBAC 設定
Function AppのマネージドID(`Memo.Func.ManagedID`)に対して`App Configuration Data Owner`ロールを割り当てます。

![08](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/80c7921e-4484-432c-8287-92f0d154f262)

## Function App／Logic Apps間の保護
### Function App への認証設定
作成したFunction Appの”Authentication”メニューを展開し、”Add provider”を選択後、以下設定値で認証プロバイダー設定を追加します。

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Identity Provider` | Microsoft |
| `App registration type` | Provide the details of an existing app registration |
| `Application(client) Id` | `Memo.LA.ManagedID` |
| `Client Secret` | 空白 |
| `Issuer URL` | https://sts.windows.net/`Memo.DirectoryID` |
| `Allowed token audiences` | https://management.azure.com |
| `Restrict access` | Require authentication |
| `Unauthenticated requests` | HTTP 401 |

![09](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/60d0d73f-2a77-410b-8ae4-21f75143f884)

## Logic Apps／Power Automate間の保護
### Logic Apps 認証用 Entra ID アプリ作成
a. Azure ポータルで Azure Active Directory メニューを開き、”App registration”を選択し新規アプリを以下設定値で登録します。

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Name` | 任意のアプリ識別名を入力 |
| `Supported account types` | Accounts in this organizational directory only |
| `Redirect URI` | 空白 |

b. 作成したアプリのApplication IDを`Memo.LA.EntraApp.ID`としてメモします。

![10](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/ce2d723e-33f6-4fe7-a559-d347e640a9e1)

c. 作成したアプリの”Expose an API”メニューからApplication ID URIを設定し`Memo.LA.EntraApp.URI`としてメモします。

![11](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/050aaaed-713d-47e0-851c-aae6a9ad6178)

d. API スコープを追加します。

![12](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/6e01cf23-5795-4148-b48b-9ce48e11656f)

### Power Automate 認証用 Entra ID アプリ作成
a. Azure ポータルで Azure Active Directory メニューを開き、”App registration”を選択し新規アプリを以下設定値で登録します。

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Name` | 任意のアプリ識別名を入力 |
| `Supported account types` | Accounts in this organizational directory only |
| `Redirect URI` | 空白 |

b. 作成したアプリのApplication IDを`Memo.PA.EntraApp.ID`としてメモします。

![13](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/cd5b3430-9f54-4bb9-ab93-30a68c4898c7)

c. 作成したアプリにクライアントシークレットを作成し、生成された値を`Memo.PA.EntraApp.SC`としてメモします。

![14](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/d96ee31a-cbe5-4528-8c15-0b9e79c32de7)

### Logic Apps への認証ポリシー構成
a. 作成したLogic Appリソースの”Authorization”メニューより”Add policy”を選択後、以下設定値でポリシーを作成します。

| クレーム種別 | 名前 | 値 |
| ------------- | ------------- | ------------- |
| Standard | `Issuer` | https://sts.windows.net/`Memo.DirectoryID` |
| Standard | `Audience` | `Memo.LA.EntraApp.ID` |
| Custom | `appid` | `Memo.PA.EntraApp.ID` |

![15](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/a08c6349-13dd-428e-b324-41f8682e7fd6)

## Function Appへのアプリ展開
### Visual Studio Code からの Function プロジェクトの展開

## Logic Apps フローの作成
”HTTP要求をパラメーター付きで受け取り、Function Appをトリガーし状態コード、及びBodyをHTTP応答する”フローを作成します。

![16](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/dd63a36b-9374-4693-b423-eb5b821393b2)

各フロー内アクションの設定値は以下の通りです。

- When a HTTP request is received

![17](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/4d0b564d-24d1-4d5e-a05a-6d0bb7ec73fa)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `HTTP POST URL` | 自動生成 |
| `Request Body JSON Schema` | { <br>   "key":"", <br>    "label":"" <br> } <br> ※Use sample payload to generate schemaから上記サンプルスキーマを入力し生成 |

フロー保存時に自動生成されるHTTP POST URLを以下規則に則り編集し、`Memo.LA.POSTURL`としてメモします。

| 編集前 | 編集後 |
| ------------- | ------------- |
| https://prod-15.japaneast.logic.azure.com:443/workflows/xxxxxxxxxxxxxxxxxxxxxxxxxx/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xxxxxxxxxxxxxxxxxxxxx | https://prod-15.japaneast.logic.azure.com:443/workflows/xxxxxxxxxxxxxxxxxxxxxxxxxx/triggers/manual/paths/invoke?api-version=2016-10-01 |

- LogicAppHttpTrigger

![18](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/a77b512d-a10b-4990-9388-2faed208b457)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Request Body` | 空白 |
| `Method` | GET |
| `Queries` | { <br>    "key":HTTPトリガーから`key`を参照, <br>    "label":HTTPトリガーから`label`を参照 <br> } |
| `Authentication type` | Managed identity |
| `Managed identity` | System-assigned managed identity |
| `Audience` | https://management.azure.com |

- Response on Success

![19](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/c4934fcd-6fee-4583-85a1-7c25afc0c3d6)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Status Code` | 200 |
| `Headers` | 空白 |
| `Body` | Functionアクションから`Body`を参照 |

## Power Automateフローの作成
”Power Appsから要求をパラメーター付きで受け取り、Logic Appsフローをトリガーし返ってきたBodyを応答する”フローを作成します。

![20](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/3cc14aae-4343-406b-b7ab-aa3062015cc3)


各フロー内アクションの設定値は以下の通りです。

- PowerApps (V2)

![21](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/880860e4-613b-437a-b9e6-8c4499be527d)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `key` | key value |
| `label` | label value |

- HTTP

![22](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/b3b341a5-b5df-4f65-89ce-7aeced8afa41)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `方法` | POST |
| `URI` | `Memo.LA.POSTURL` |
| `本文` | { <br>  "key": PowerAppsトリガーから`key`を参照, <br>  "label": PowerAppsトリガーから`label`を参照 <br>} |
| `認証` | Active Directory OAuth |
| `テナント` | `Memo.DirectoryID` |
| `対象ユーザー` | `Memo.LA.EntraApp.ID` |
| `クライアントID` | `Memo.PA.EntraApp.ID` |
| `資格情報の種類` | シークレット |
| `シークレット` | `Memo.PA.EntraApp.SC` |

- PowerApp または Flow に応答する

![23](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/549e679a-0507-4cf8-b26a-49fa6676e146)

| 設定名 | 設定値 |
| ------------- | ------------- |
| `Return` | HTTPアクションから`本文`を参照 |

## Power Apps アプリの作成
ここまで作成してきた Power Automate フロー、並びに Logic Apps フローにパラメータ付きで要求を送信する為の Power Apps アプリを作成します。
主要な画面上の項目は以下の通りです。

![24](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/5845ad00-3e34-4915-b31c-84d288a6b8f0)

各項目に設定した関数は以下の通りです。

| 項目名 | プロパティ | 関数 |
| ------------- | ------------- | ------------- |
| `Dropdown1` | Items | ["SecurityPolicy01","SecurityPolicy02"] |
| `Dropdown1_1` | Items | ["v1","v2"] |
| `Button1` | OnSelect | Set(`ReturnBody`,'POC-AppConf-Bridge'.Run(Dropdown1.SelectedText.Value,Dropdown1_1.SelectedText.Value).return) |
| `Label3` | Text | `ReturnBody` |

事前に作成した Power Automate フローを関連付けておきます。

![25](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/85638d0d-479c-4110-a276-1748804d340d)

## 参考情報
[Securing Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/security-concepts?tabs=v4)

[Set up Azure App Service access restrictions](https://learn.microsoft.com/en-us/azure/app-service/app-service-ip-restrictions?tabs=azurecli)

[Enable authentication for function calls](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-azure-functions?tabs=consumption#enable-authentication-for-function-calls-consumption-workflows-only)

[Authenticate with managed identities](https://learn.microsoft.com/en-us/azure/logic-apps/create-managed-service-identity?tabs=consumption#authenticate-access-with-identity)

[Use flow in PowerApps to upload files or return data tables](https://powerautomate.microsoft.com/cs-cz/blog/howto-upload-return-file/)
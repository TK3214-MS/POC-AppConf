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

b. Endpoint値をMemo.AppConf.Endpointとしてメモします。

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

c. システム割り当てマネージドIDを有効化し、Memo.Func.ManagedIDとしてObject IDをメモします。

![05](https://github.com/TK3214-MS/POC-AppConf/assets/89323076/599beed4-da97-4f69-8717-5c30c9a0f93a)
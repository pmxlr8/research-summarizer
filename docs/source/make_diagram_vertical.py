"""
Vertical (TB) variant of the architecture diagram.

The main make_diagram.py produces the landscape (LR) version — good for
embedding in documents. This script produces the tall vertical variant,
useful for slides, posters, or on-screen presentations where a portrait
layout reads more naturally.
"""
from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import Route53, CloudFront, APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.security import Cognito, IAM
from diagrams.aws.compute import Lambda
from diagrams.aws.integration import SQS, StepFunctions, SNS
from diagrams.aws.database import Dynamodb
from diagrams.aws.ml import Bedrock
from diagrams.aws.management import Cloudwatch
from diagrams.onprem.client import User

graph_attr = {
    "fontsize": "24",
    "fontname": "Helvetica-Bold",
    "bgcolor": "white",
    "pad": "0.4",
    "nodesep": "0.3",
    "ranksep": "0.55",
    "splines": "spline",
    "labelloc": "t",
    "compound": "true",
}
node_attr = {"fontsize": "12", "fontname": "Helvetica"}
edge_attr = {"fontsize": "11", "fontname": "Helvetica"}


def band(bg):
    return {
        "rankdir": "LR",
        "style": "rounded,filled",
        "bgcolor": bg,
        "fontsize": "20",
        "fontname": "Helvetica-Bold",
        "labeljust": "l",
        "penwidth": "2",
        "margin": "30",
    }


with Diagram(
    "Cloud-Based Research Paper Summarization Platform — AWS Architecture",
    filename="Architecture_Vertical",
    outformat=["png", "svg"],
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    user = User("End User")

    with Cluster("AWS Cloud — us-east-1",
                 graph_attr={"rankdir": "TB", "style": "rounded", "bgcolor": "#F7F9FB",
                             "fontsize": "22", "fontname": "Helvetica-Bold",
                             "labeljust": "l", "penwidth": "2", "margin": "18"}):

        with Cluster("Edge & Frontend", graph_attr=band("#E8F5E9")):
            dns = Route53("Route 53\n(DNS)")
            cdn = CloudFront("CloudFront\n(CDN + TLS)")
            s3_fe = S3("S3 Frontend\nNext.js (OAI)")
            dns >> Edge(color="#232F3E") >> cdn
            cdn >> Edge(label="static", color="#7AA116") >> s3_fe

        with Cluster("API Layer", graph_attr=band("#FCE4EC")):
            cognito = Cognito("Cognito\nUser Pool")
            apigw = APIGateway("API Gateway\n(REST)")
            fn_search = Lambda("searchFn")
            fn_submit = Lambda("submitJobFn")
            fn_get = Lambda("getSummaryFn")
            cognito >> Edge(label="JWT", style="dashed", color="#DD344C") >> apigw
            apigw >> Edge(color="#ED7100") >> fn_search
            apigw >> Edge(color="#ED7100") >> fn_submit
            apigw >> Edge(color="#ED7100") >> fn_get

        with Cluster("Async Summarization Pipeline", graph_attr=band("#FFEBEE")):
            jobs = SQS("SQS\nJobs Queue")
            dlq = SQS("SQS\nDLQ")
            sfn = StepFunctions("Step Functions\nState Machine")
            s_fetch = Lambda("1. FetchPDF")
            s_extract = Lambda("2. ExtractText")
            s_chunk = Lambda("3. Chunk")
            s_map = Lambda("4. MapSummarize\n(parallel)")
            bedrock = Bedrock("Amazon Bedrock\n(Claude Sonnet)")
            s_reduce = Lambda("5. ReduceSummary")

            jobs >> Edge(label="trigger", color="#E7157B") >> sfn
            sfn >> Edge(color="#555") >> s_fetch
            s_fetch >> Edge(color="#555") >> s_extract
            s_extract >> Edge(color="#555") >> s_chunk
            s_chunk >> Edge(color="#555") >> s_map
            s_map >> Edge(color="#555") >> s_reduce
            s_map >> Edge(label="invoke", color="#01A88D") >> bedrock
            bedrock >> Edge(label="summary", color="#01A88D", style="dashed",
                            constraint="false") >> s_reduce
            jobs >> Edge(label="3 fails", style="dashed", color="#E7157B",
                         constraint="false") >> dlq

        with Cluster("Data Stores", graph_attr=band("#E3F2FD")):
            s3_pdf = S3("S3 PDFs Bucket\n(raw papers)")
            ddb = Dynamodb("DynamoDB\n(single-table)")

        with Cluster("Observability & Security", graph_attr=band("#ECEFF1")):
            cw = Cloudwatch("CloudWatch\nLogs + Alarms")
            iam = IAM("IAM\nleast-privilege")
            sns = SNS("SNS alerts")
            cw >> Edge(label="on alarm", style="dashed", color="#E7157B") >> sns

    user >> Edge(label="https", color="#232F3E") >> dns
    cdn >> Edge(label="API requests", color="#232F3E") >> apigw
    fn_submit >> Edge(label="enqueue", color="#E7157B") >> jobs
    s_fetch >> Edge(label="put PDF", color="#7AA116") >> s3_pdf
    s_reduce >> Edge(label="write summary", color="#3334B9") >> ddb

print("Vertical diagram generated: Architecture_Vertical.png and .svg")
